# Hermes — Blink & Comb Implementation Plan

*Designing session-context continuity and lossless memory for the OWL agent runtime.*

**Status:** DRAFT — ready for integration into Hermes runtime
**Author:** OWL (based on Symbiote 3.0 research)
**Date:** June 23, 2026

---

## 1. Problem Statement

The current Hermes agent runtime has two critical failure modes:

1. **Context wall:** Long sessions hit max-iteration limits and lose continuity. The agent appears to "die" mid-task from the user's perspective.
2. **Session amnesia:** Each new session starts fresh. Agents rely on `session_search` (external FTS5 DB) but lose the *working state* of the current session — what was being worked on, what was just learned, what was about to be done.

Symbiote 3.0 solves these with two modules:
- **Blink** — seamless session continuation across iteration boundaries
- **Comb** — lossless operational memory that survives session restarts

This document designs in-house replacements optimized for Hermes's specific architecture.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    HERMES AGENT LOOP                      │
│                                                          │
│  each turn → check blink.prepareAt → inject if needed   │
│            → check blink.checkpointInterval → save state │
│            → run LLM call                                │
│            → process tool calls                          │
│            → check needsBlink(budget exhausted?)         │
│                                                          │
│  on budget exhausted:                                    │
│    blink.recordBlink()                                   │
│    sleep(cooldownMs)                                     │
│    inject getResumeMessage()                             │
│    spawn Hermes turn with same session + resume msg      │
│                                                          │
│  on session end (timeout/exit):                          │
│    comb.flushMessages(session_label, messages)           │
│                                                          │
│  on session start:                                       │
│    comb.recall() → inject context into system prompt     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   STORAGE LAYER                          │
│                                                          │
│  .blink/                                                 │
│    state.json        — BlinkState per session            │
│    checkpoints/      — Periodic checkpoint files         │
│                                                          │
│  .comb/                                                  │
│    staging/YYYY-MM-DD.json  — append-only daily entries  │
│    archive/YYYY-MM-DD.json  — rolled-up archive docs     │
│    state.json               — metadata (lastRollup, etc)  │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Blink — Seamless Continuation

### 3.1 Core Data Model

```python
@dataclass
class BlinkState:
    session_id: str
    depth: int = 0                    # Consecutive blinks this session
    phase: str = "normal"             # normal | prepare | blinking | resumed | capped
    total_iterations: int = 0         # Sum across all blinks
    total_tool_calls: int = 0
    blink_timestamps: list[float] = field(default_factory=list)
    prepared: bool = False            # Prepare message injected this cycle
    last_checkpoint_at: int = 0       # Iteration when last checkpoint was injected
    cap_expansions: int = 0           # How many times PULSE expanded the cap

@dataclass
class BlinkConfig:
    enabled: bool = True
    max_depth: int = 5                # Max consecutive blinks per conversation
    prepare_at: int = 3               # Inject prepare message N turns before wall
    cooldown_ms: int = 500            # Delay between blink and resume
    checkpoint_interval: int = 25     # Inject checkpoint every N turns (0=disabled)
```

### 3.2 Integration Points in Hermes

**A. At turn start (before LLM call):**
```python
def pre_turn(state: BlinkState, remaining_turns: int):
    if not state.enabled or state.phase == "capped":
        return
    
    if remaining_turns <= state.prepare_config.prepare_at and not state.prepared:
        inject_message(BLINK_PREPARE_MESSAGE)
        state.prepared = True
        state.phase = "prepare"
    
    elif state.checkpoint_interval > 0:
        iterations_done = state.total_iterations
        if iterations_done - state.last_checkpoint_at >= state.config.checkpoint_interval:
            inject_message(BLINK_CHECKPOINT_MESSAGE)
            state.last_checkpoint_at = iterations_done
```

**B. At turn end (after processing response):**
```python
def post_turn(state: BlinkState, budget_exhausted: bool, 
              iterations: int, tool_calls: int):
    state.total_iterations += iterations
    state.total_tool_calls += tool_calls
    
    if budget_exhausted and state.enabled:
        if state.depth < state.config.max_depth:
            state.record_blink(iterations, tool_calls)
            state.phase = "blinking"
            # Hermes main loop should now:
            #   1. sleep(cooldown_ms)
            #   2. resume with fresh turn, same session
            #   3. inject BLINK_RESUME_MESSAGE
        else:
            state.phase = "capped"
    
    # PULSE: if cap was dynamically expanded, re-arm prepare
    # (Hermes-specific: if user increases max iterations mid-session)
    if state.prepared and state.phase == "normal":
        state.prepared = False  # Re-arm for next cycle
```

### 3.3 Blink Messages

```python
BLINK_PREPARE_MESSAGE = """[SYSTEM — SEAMLESS CONTINUATION]
Your next response may be your last for this turn. 
If you have more work to do after this, it will continue automatically.
IMPORTANT: Do NOT wrap up or summarize. Continue your work mid-thought if needed.
Long tasks may require multiple continuation turns — trust the system to carry you forward."""

BLINK_CHECKPOINT_MESSAGE = """[SYSTEM — CHECKPOINT]
State snapshot opportunity. If you have critical in-memory state that should survive
a session restart, save it now using: `memory(action='add', ...)` or equivalent.
This is advisory — skip if nothing critical."""

BLINK_RESUME_MESSAGE = lambda depth, max_depth, total: (
    f"""[SYSTEM — SEAMLESS CONTINUATION RESUMED]
Previous turn exhausted its iteration budget. Picking up exactly where you left off.

Current continuation: {depth}/{max_depth} | Total turns across blinks: {total}

IMPORTANT: You are mid-task. Continue IMMEDIATELY without preamble, summary, or recapping.
Pick up the exact thread you were on. Do not re-introduce yourself or ask what's next."""
)
```

---

## 4. Comb — Lossless Operational Memory

### 4.1 Core Data Model

```python
@dataclass
class StagingEntry:
    text: str
    timestamp: str          # ISO 8601
    source: str             # 'agent', 'auto-flush', 'checkpoint'

@dataclass
class ArchiveDocument:
    date: str               # YYYY-MM-DD
    content: str            # Concatenated staged text with timestamps
    entry_count: int
    rolled_at: str          # ISO 8601
    hash: str = ""          # SHA-256 of content
    prev_hash: str = ""     # Chain linkage for integrity
```

### 4.2 Storage Layout

```
workspace/.comb/
├── staging/
│   └── YYYY-MM-DD.json        # Array of StagingEntry
├── archive/
│   └── YYYY-MM-DD.json        # Array of ArchiveDocument
└── state.json                 # { lastRollup, totalArchived, updatedAt }
```

### 4.3 Core Operations

```python
class CombStore:
    def __init__(self, workspace: str):
        self.workspace = workspace
        self.staging_dir = f"{workspace}/.comb/staging"
        self.archive_dir = f"{workspace}/.comb/archive"
        os.makedirs(self.staging_dir, exist_ok=True)
        os.makedirs(self.archive_dir, exist_ok=True)
    
    def stage(self, text: str, source: str = "agent"):
        """Append entry to today's staging JSON. Auto-rollup at >10 entries."""
        today = date.today().isoformat()
        path = f"{self.staging_dir}/{today}.json"
        
        entries = json.loads(open(path).read()) if os.path.exists(path) else []
        entries.append(StagingEntry(text, datetime.now().isoformat(), source))
        
        if len(entries) > 10:
            self.rollup()  # Auto-rollup when staging gets large
        
        json.dump(entries, open(path, 'w'), indent=2)
    
    def recall(self) -> str:
        """Return recent context: today's + yesterday's staging, latest archive."""
        self._auto_rollup_stale()  # Rollup any non-today staging
        
        today = date.today().isoformat()
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        
        parts = []
        
        # Today's staging (last 5 entries)
        today_entries = self._read_staging(today)
        for e in today_entries[-5:]:
            parts.append(f"[{e.timestamp}] {e.text}")
        
        # Yesterday's staging (last 3 entries)
        yesterday_entries = self._read_staging(yesterday)
        for e in yesterday_entries[-3:]:
            parts.append(f"[{e.timestamp}] {e.text}")
        
        # Latest archive doc
        latest_archive = self._read_latest_archive()
        if latest_archive:
            parts.append(f"\n--- ARCHIVE (rolled {latest_archive.rolled_at}) ---")
            parts.append(latest_archive.content[-2000:])  # Last 2 chars
        
        return "\n".join(parts)
    
    def flush_messages(self, session_label: str, messages: list, tail_count: int = 4):
        """Auto-flush conversation tail on session end."""
        # Filter out system/tool messages
        convo = [m for m in messages if m.get('role') in ('user', 'assistant')]
        tail = convo[-tail_count:]
        
        text = f"[Session: {session_label}]\n"
        for m in tail:
            role = "Agent" if m['role'] == 'assistant' else "Human"
            text += f"{role}: {m['content'][:500]}\n"
        
        self.stage(text, source="auto-flush")
    
    def rollup(self, date_str: str = None) -> bool:
        """Promote staging → archive. Builds timestamped content."""
        date_str = date_str or date.today().isoformat()
        path = f"{self.staging_dir}/{date_str}.json"
        
        if not os.path.exists(path):
            return False
        
        entries = json.loads(open(path).read())
        if not entries:
            return False
        
        timestamps, texts = zip(*[(e['timestamp'], e['text']) for e in entries])
        content = "\n".join(f"[{t}] {txt}" for t, txt in zip(timestamps, texts))
        
        # Build chain hash
        prev_hash = self._get_latest_archive_hash() or "0" * 64
        h = hashlib.sha256((prev_hash + content).encode()).hexdigest()
        
        archive = ArchiveDocument(
            date=date_str,
            content=content,
            entry_count=len(entries),
            rolled_at=datetime.now().isoformat(),
            hash=h,
            prev_hash=prev_hash
        )
        
        archive_path = f"{self.archive_dir}/{date_str}.json"
        existing = json.loads(open(archive_path).read()) if os.path.exists(archive_path) else []
        existing.append(asdict(archive))
        
        json.dump(existing, open(archive_path, 'w'), indent=2)
        os.remove(path)  # Clear staging
        return True
```

---

## 5. Integration with Hermes Runtime

### 5.1 Turn Lifecycle (Full)

```python
async def run_turn(messages, session_id, blink_state, comb_store):
    """
    Full Hermes turn with Blink + Comb integration.
    """
    # A. Session start: recall from Comb
    if is_new_session(session_id):
        context = comb_store.recall()
        if context:
            messages.insert(0, {"role": "system", "content": f"[COMB MEMORY]\n{context}"})
            blink_state.phase = "normal"
    
    # B. Pre-turn: check Blink prepare/checkpoint
    remaining = max_iterations - blink_state.total_iterations
    pre_turn(blink_state, remaining)
    
    # C. Run LLM
    response = await hermes_llm(messages)
    blink_state.total_iterations += 1
    
    # D. Process tool calls
    tool_results = await process_tool_calls(response)
    blink_state.total_tool_calls += len(tool_results)
    
    # E. Post-turn: check Blink budget
    if response.get('budget_exhausted'):
        budget_exhausted = True
    else:
        budget_exhausted = False
    
    post_turn(blink_state, budget_exhausted, iterations=1, tool_calls=len(tool_results))
    
    # F. Handle blink result
    if blink_state.phase == "blinking":
        return {
            "status": "blink",
            "resume_message": BLINK_RESUME_MESSAGE(
                blink_state.depth, 
                blink_state.config.max_depth,
                blink_state.total_iterations
            ),
            "blink_state": blink_state
        }
    
    # G. Normal return
    return {"status": "ok", "response": response, "tool_results": tool_results}
```

### 5.2 Flush on Session End

```python
def on_session_end(session_id, messages):
    """Called when a Hermes session terminates (timeout, /stop, etc.)."""
    comb_store = CombStore(os.getcwd())
    label = f"{session_id}_{datetime.now().strftime('%H%M')}"
    comb_store.flush_messages(label, messages)
```

### 5.3 Checkpoint Triggered by External Kill

```python
def on_graceful_shutdown(session_id, messages, blink_state):
    """Called on SIGTERM or /stop — save everything possible."""
    # Stage critical state via comb
    comb_store = CombStore(os.getcwd())
    
    # Serialize blink state for next session
    state_path = os.path.join(os.getcwd(), ".blink/state.json")
    json.dump(asdict(blink_state), open(state_path, 'w'))
    
    # Flush conversation tail
    label = f"{session_id}_kill_{datetime.now().strftime('%H%M')}"
    comb_store.flush_messages(label, messages)
```

---

## 6. Hermes-Specific Advantages over Symbiote

| Feature | Symbiote (raw) | This Design |
|---------|---------------|-------------|
| Blink integration | Requires daemon runner | Native to Hermes agent loop |
| Comb search | FTS5 only | Can use Hybrid memory (HEKTOR) |
| Checkpoint trigger | Every N turns, external | Built into agent loop |
| Resume context | Just last conversation tail | Comb recall (staging + archive) |
| Session profiling | No | `profile` param on sessions |
| Cross-session continuity | Blink resets per session | `session_id` persistence |
| Native tool exposure | `comb_recall`, `comb_stage` | `memory` tool already exists — extend |

---

## 7. Implementation Plan

### Phase 1: Comb (Simpler, High Value)
1. Create `~/.comb/` directory structure in `hermes-agent` skill
2. Implement `CombStore` as Python module (can embed in skill)
3. Extend existing `memory` tool with `flush_messages` on session end
4. Add `recall` injection into system prompt at session start
5. Test: create info, end session, new session → verify recall works

### Phase 2: Blink (Requires Loop Changes)
1. Add `BlinkConfig` to Hermes config (or `blink:` section in config.yaml)
2. Track iteration count per session
3. Implement `pre_turn()` / `post_turn()` checks in agent loop
4. Handle `blink` status return → sleep → resume with same session
5. Test: long task → verify seamless continuation

### Phase 3: Combined Flow
1. Blink checkpoint → trigger `comb_stage` (saves before continuation)
2. Blink resume → trigger `comb_recall` (restores on new turn)
3. Session end → `flush_messages` + serialize blink state
4. Session start → load blink state + comb recall into prompt

---

## 8. Monitoring & Observability

```python
# Blink metrics (exposed via /blink-status)
{
    "session_id": "20260623_142000",
    "phase": "normal",
    "depth": 1,
    "total_iterations": 47,
    "prepared": true,
    "cap_expansions": 0
}

# Comb metrics (exposed via /comb-status)
{
    "staging_entries": 4,
    "archive_docs": 2,
    "last_rollup": "2026-06-23T03:00:00Z",
    "total_staged_today": 4
}
```

---

## 9. Failure Modes & Mitigations

| Failure | Mitigation |
|---------|-----------|
| Blink max_depth reached | Fall back to graceful shutdown + comb flush |
| Comb write fails (disk full) | Log error, continue without—non-fatal |
| Corrupt staging JSON | Rotate to .corrupt, start fresh for today |
| Blink state lost | Comb recall still provides context archive |
| Resume context too large | Truncate recall to context window limits |
| Multiple sessions racing | Per-session file locking or session_id suffix |

---

*This document is ready for review. Once approved, Phase 1 (Comb) can be implemented immediately as a skill module. Phase 2 (Blink) requires agent loop modifications.*
