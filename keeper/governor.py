"""
Governor — Autonomous Governance Actions for the Keeper.

The keeper is the ecosystem warden. When conditions demand it, the keeper
can propose governance actions through the Governor contract:

- Emergency pause proposals (if a critical threat is detected)
- Gauge weight voting (direct emissions toward productive pools)
- Treasury rebalancing proposals
- Parameter adjustments (caps, thresholds, cooldowns)

All proposals go through the Timelock, so there's a 48h delay before
execution. The keeper proposes; the protocol decides.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

from .logger import get_logger
from .config import Settings

log = get_logger("governor")


# ─────────────────────────────────────────────────────────────────────────────
# Proposal Types
# ─────────────────────────────────────────────────────────────────────────────

class ProposalType(Enum):
    EMERGENCY_PAUSE = "emergency_pause"
    EMERGENCY_UNPAUSE = "emergency_unpause"
    GAUGE_VOTE = "gauge_vote"
    PARAMETER_CHANGE = "parameter_change"
    TREASURY_REBALANCE = "treasury_rebalance"
    BUYBACK_CAP_CHANGE = "buyback_cap_change"


class ProposalStatus(Enum):
    DRAFT = "draft"
    PROPOSED = "proposed"
    QUEUED = "queued"
    EXECUTED = "executed"
    DEFEATED = "defeated"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


# ─────────────────────────────────────────────────────────────────────────────
# Proposal
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Proposal:
    """A governance proposal drafted by the keeper."""
    proposal_type: ProposalType
    title: str
    description: str
    targets: list[str]
    values: list[int]
    calldatas: list[str]
    status: ProposalStatus = ProposalStatus.DRAFT
    proposal_id: Optional[int] = None
    created_at: float = field(default_factory=time.time)
    proposed_at: Optional[float] = None
    executed_at: Optional[float] = None
    reason: str = ""  # Why the keeper drafted this

    @property
    def age_hours(self) -> float:
        return (time.time() - self.created_at) / 3600

    def to_governor_calldata(self) -> dict:
        """Format for GovernorContract.propose()."""
        return {
            "targets": self.targets,
            "values": self.values,
            "calldatas": self.calldatas,
            "description": self.description,
        }


# ─────────────────────────────────────────────────────────────────────────────
# Gauge Voting
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class GaugeVote:
    """A vote on emission gauge weights."""
    gauge_address: str
    weight: int  # 0-10000 (basis points)
    reason: str = ""


class GaugeVotingStrategy:
    """
    Determines how the keeper should vote on emission gauges.
    
    Strategy:
    - Vote for gauges with the highest revenue per $ emitted
    - Vote against gauges with low volume/manipulation
    - Can be overridden for emergency situations
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.vote_history: list[GaugeVote] = ()

    def calculate_votes(
        self,
        gauges: list[dict],
        threat_level: int = 0,
    ) -> list[GaugeVote]:
        """
        Calculate optimal gauge votes.
        
        Args:
            gauges: List of gauge info dicts with keys:
                address, tvl, volume_24h, fees_24h, current_weight
            threat_level: Current warden threat level
            
        Returns:
            List of GaugeVote recommendations
        """
        if not gauges:
            return []

        # Score each gauge
        scored = []
        for g in gauges:
            fees = g.get("fees_24h", 0)
            tvl = g.get("tvl", 1)
            volume = g.get("volume_24h", 0)

            # Revenue efficiency: fees per TVL
            revenue_score = fees / max(tvl, 1)

            # Volume health
            volume_score = volume / max(tvl, 1)

            # Combined score
            score = revenue_score * 0.6 + volume_score * 0.4

            scored.append((g, score))

        # Sort by score descending
        scored.sort(key=lambda x: x[1], reverse=True)

        # Distribute weights: top gauge gets 50%, rest split proportionally
        total_score = sum(max(s, 0.0001) for _, s in scored)
        votes = []

        for i, (gauge, score) in enumerate(scored):
            if i == 0:
                weight = 5000  # 50% to top gauge
            else:
                weight = int((score / total_score) * 5000)

            weight = max(0, min(10000, weight))

            votes.append(GaugeVote(
                gauge_address=gauge["address"],
                weight=weight,
                reason=f"score={score:.4f}, rank={i+1}",
            ))

        return votes


# ─────────────────────────────────────────────────────────────────────────────
# Emergency Actions
# ─────────────────────────────────────────────────────────────────────────────

class EmergencyActions:
    """
    Drafts emergency governance proposals when threats are detected.
    
    These are last-resort actions — the keeper detects a critical threat
    and proposes pausing the protocol through governance.
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.proposals: list[Proposal] = []

    def draft_pause_proposal(
        self,
        reason: str,
        target_contract: str,
        pause_method: str = "pause()",
        description: str = "",
    ) -> Proposal:
        """Draft an emergency pause proposal."""
        if not description:
            description = f"EMERGENCY: Pause {target_contract} — {reason}"

        proposal = Proposal(
            proposal_type=ProposalType.EMERGENCY_PAUSE,
            title=f"Emergency Pause: {target_contract[:10]}...",
            description=description,
            targets=[target_contract],
            values=[0],
            calldatas=[pause_method],  # Would be encoded calldata in production
            reason=reason,
        )

        self.proposals.append(proposal)
        log.critical(f"Emergency pause proposal drafted: {reason}")
        return proposal

    def draft_parameter_change(
        self,
        contract: str,
        method: str,
        new_value: Any,
        current_value: Any,
        reason: str,
    ) -> Proposal:
        """Draft a parameter change proposal."""
        proposal = Proposal(
            proposal_type=ProposalType.PARAMETER_CHANGE,
            title=f"Update {method} = {new_value}",
            description=(
                f"Change {method} from {current_value} to {new_value}. "
                f"Reason: {reason}"
            ),
            targets=[contract],
            values=[0],
            calldatas=[f"{method}({new_value})"],
            reason=reason,
        )

        self.proposals.append(proposal)
        log.warning(f"Parameter change proposal drafted: {method} = {new_value}")
        return proposal

    def draft_buyback_cap_change(
        self,
        new_daily_cap: int,
        new_monthly_cap: int,
        reason: str,
    ) -> Proposal:
        """Draft a proposal to change buyback caps."""
        proposal = Proposal(
            proposal_type=ProposalType.BUYBACK_CAP_CHANGE,
            title=f"Buyback Cap Change: ${new_daily_cap}/day",
            description=(
                f"Change buyback caps to ${new_daily_cap}/day, "
                f"${new_monthly_cap}/month. Reason: {reason}"
            ),
            targets=[],
            values=[],
            calldatas=[],
            reason=reason,
        )

        self.proposals.append(proposal)
        log.warning(f"Buyback cap proposal drafted: ${new_daily_cap}/day")
        return proposal


# ─────────────────────────────────────────────────────────────────────────────
# Governor Coordinator
# ─────────────────────────────────────────────────────────────────────────────

class GovernorCoordinator:
    """
    Coordinates all governance actions.
    
    Provides a clean interface for the main loop:
    - Check if emergency action is needed
    - Draft proposals
    - Track proposal status
    - Vote on gauges
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.gauge_strategy = GaugeVotingStrategy(settings)
        self.emergency = EmergencyActions(settings)
        self.proposals: list[Proposal] = []
        self.proposals_submitted = 0
        self.proposals_executed = 0
        self.proposals_defeated = 0

    def check_emergency_actions(
        self,
        threat_level: str,
        active_threats: list[dict],
    ) -> Optional[Proposal]:
        """
        Check if emergency governance action is needed.
        
        Returns a Proposal if one should be submitted, None otherwise.
        """
        if threat_level != "HALTED":
            return None

        # Check if we already have a pending emergency proposal
        pending = [
            p for p in self.proposals
            if p.proposal_type == ProposalType.EMERGENCY_PAUSE
            and p.status in (ProposalStatus.DRAFT, ProposalStatus.PROPOSED)
        ]
        if pending:
            return None  # Already have one pending

        # Find the most critical threat
        critical = [t for t in active_threats if t.get("severity") == "HALTED"]
        if not critical:
            return None

        threat = critical[0]

        # Draft appropriate proposal
        if threat["type"] == "oracle_manipulation":
            return self.emergency.draft_pause_proposal(
                reason=f"Oracle manipulation: {threat.get('description', 'unknown')}",
                target_contract="FlashBuy",
                description=(
                    f"Emergency pause of FlashBuy due to oracle manipulation. "
                    f"Details: {threat.get('description', 'N/A')}"
                ),
            )

        if threat["type"] == "liquidity_drain":
            return self.emergency.draft_pause_proposal(
                reason=f"Critical liquidity drain: {threat.get('description', 'unknown')}",
                target_contract="FlashBuy",
                description=(
                    f"Emergency pause due to critical liquidity drain. "
                    f"Details: {threat.get('description', 'N/A')}"
                ),
            )

        # Generic emergency proposal
        return self.emergency.draft_pause_proposal(
            reason=f"Critical threat: {threat.get('type', 'unknown')}",
            target_contract="FlashBuy",
        )

    def submit_proposal(self, proposal: Proposal) -> Optional[int]:
        """
        Submit a proposal to the Governor contract.
        
        Returns proposal ID if successful.
        
        In production, this would call:
        governor_contract.propose(
            targets, values, calldatas, description
        )
        """
        proposal.status = ProposalStatus.PROPOSED
        proposal.proposed_at = time.time()
        self.proposals.append(proposal)
        self.proposals_submitted += 1

        log.critical(
            f"GOVERNANCE PROPOSAL #{self.proposals_submitted}: "
            f"{proposal.title} — {proposal.description}"
        )

        # In production:
        # tx = governor_contract.functions.propose(
        #     proposal.targets,
        #     proposal.values,
        #     proposal.calldatas,
        #     proposal.description,
        # ).transact({"from": self.settings.keeper_address})
        # receipt = w3.eth.wait_for_transaction_receipt(tx)
        # proposal_id = receipt...

        return None

    def get_pending_proposals(self) -> list[Proposal]:
        """Get all pending proposals."""
        return [
            p for p in self.proposals
            if p.status in (ProposalStatus.PROPOSED, ProposalStatus.QUEUED)
        ]

    def get_status(self) -> dict:
        """Return governor coordinator status."""
        return {
            "total_proposals": len(self.proposals),
            "submitted": self.proposals_submitted,
            "executed": self.proposals_executed,
            "defeated": self.proposals_defeated,
            "pending": len(self.get_pending_proposals()),
        }
