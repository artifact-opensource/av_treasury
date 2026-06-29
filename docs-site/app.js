// ═══════════════════════════════════════════════════════════════
// AV TREASURY — DOCUMENTATION SITE
// ═══════════════════════════════════════════════════════════════

// ═══ CONTRACT DATA ═══
const contracts = [
  { name: "Au Token", role: "Reserve-backed utility token. 1B cap, 9bps tax.", cat: "token", addr: "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08" },
  { name: "Ag Token", role: "Governance token. 100M cap, PID-minted.", cat: "token", addr: "0x1D31719389Bd8b17277Ba367c26b830aE34D3674" },
  { name: "TreasuryAMO", role: "Central vault. AMO operations via Slipstream.", cat: "core", addr: "0x56653245f4718fe105b95C8424947B31b84b5188" },
  { name: "PIDController", role: "Monetary policy engine. Dynamic emission targeting.", cat: "core", addr: "0x991138923880773D67c01392c31A255e770F7f70" },
  { name: "Governor", role: "DAO governance. 100K threshold, 30-day voting.", cat: "gov", addr: "0x259c1C2354Bc9e1eF20ee3B7b1D8580Cb5F06385" },
  { name: "Timelock", role: "48h delayed execution for governance.", cat: "gov", addr: "0x662321CC63700865838aB08378061BE499344714" },
  { name: "OracleWrapper", role: "TWAP price feeds. AvOracle v5 backed.", cat: "oracle", addr: "0xb479760Dfd9Ba90cF670BBB1647a4B06B2032bdB" },
  { name: "AvOracle v5", role: "Multi-source oracle. Manipulation-resistant.", cat: "oracle", addr: "0xfd0451a53834E4DAa9626A24B9Aa640B0d3647CD" },
  { name: "FlashBuy v2", role: "Treasury buyback mechanism.", cat: "core", addr: "0xf6383860837E6cb983F9Af8Def92fc08F15Be65b" }
];

// ═══ CONTRACT GRID ═══
function renderContracts(filter) {
  const grid = document.getElementById('contracts-grid');
  if (!grid) return;
  const filtered = filter === 'all' ? contracts : contracts.filter(c => c.cat === filter);
  grid.innerHTML = filtered.map(c => `
    <div class="arch-card">
      <div class="arch-head">
        <span class="material-icons-outlined">${iconFor(c.cat)}</span>
        <h3>${c.name}</h3>
      </div>
      <p>${c.role}</p>
      <a href="https://basescan.org/address/${c.addr}" target="_blank" class="addr-link">${c.addr.slice(0,6)}…${c.addr.slice(-4)}</a>
    </div>
  `).join('');
  observeCards();
}

function iconFor(cat) {
  return { token: 'workspace_premium', core: 'account_balance', gov: 'how_to_vote', oracle: 'sensors' }[cat] || 'code';
}

// Contract filter buttons
document.querySelectorAll('.cf-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cf-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderContracts(btn.dataset.filter);
  });
});

// ═══ PID CALCULATOR ═══
function runCalc() {
  const target = parseFloat(document.getElementById('c-target').value) || 0;
  const actual = parseFloat(document.getElementById('c-actual').value) || 0;
  const kp = parseFloat(document.getElementById('c-kp').value) || 0;
  const ki = parseFloat(document.getElementById('c-ki').value) || 0;
  const kd = parseFloat(document.getElementById('c-kd').value) || 0;

  const error = target - actual;
  const integral = error * 5; // 5-day epoch
  const derivative = -actual * 0.01; // dampening

  const emission = Math.max(0, kp * error / 1e6 + ki * integral / 1e6 + kd * derivative / 1e6);

  document.getElementById('c-result').textContent = emission.toFixed(2);
  document.getElementById('c-breakdown').innerHTML = `
    <div class="pp-row"><span>P term (Kp × e)</span><span>${(kp * error / 1e6).toFixed(2)}</span></div>
    <div class="pp-row"><span>I term (Ki × ∫e)</span><span>${(ki * integral / 1e6).toFixed(2)}</span></div>
    <div class="pp-row"><span>D term (Kd × de/dt)</span><span>${(kd * derivative / 1e6).toFixed(2)}</span></div>
    <div class="pp-row"><span>Error (target − actual)</span><span>$${(error/1e6).toFixed(1)}M</span></div>
  `;
}

const calcBtn = document.getElementById('c-run');
if (calcBtn) calcBtn.addEventListener('click', runCalc);

// ═══ LIVE PRICE — DEXScreener ═══
const AU_ADDRESS = '0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08';

async function fetchAuPrice() {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${AU_ADDRESS}`);
    const data = await res.json();
    if (data.pairs && data.pairs.length > 0) {
      const pair = data.pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      const price = parseFloat(pair.priceUsd);
      const change = pair.priceChange?.h24 || 0;
      const vol = pair.volume?.h24 || 0;
      const liq = pair.liquidity?.usd || 0;

      document.getElementById('au-price').textContent = '$' + price.toFixed(6);
      const changeEl = document.getElementById('au-change');
      changeEl.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '% 24h';
      changeEl.className = 'lt-change ' + (change >= 0 ? 'pos' : 'neg');
      document.getElementById('au-vol').textContent = '$' + formatNum(vol);
      document.getElementById('au-liq').textContent = '$' + formatNum(liq);
      document.getElementById('au-time').textContent = new Date().toLocaleTimeString();
    } else {
      document.getElementById('au-price').textContent = 'No pool data';
    }
  } catch (e) {
    document.getElementById('au-price').textContent = 'Unavailable';
    console.warn('Price fetch failed:', e);
  }
}

function formatNum(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

fetchAuPrice();
setInterval(fetchAuPrice, 60000);

// ═══ SCROLL OBSERVER ═══
function observeCards() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.arch-card, .token-panel, .pid-dc, .gov-step, .gp-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    observer.observe(el);
  });
}

// ═══ NAV HIGHLIGHT ═══
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(section => {
    const top = section.offsetTop;
    if (scrollY >= top - 100) current = section.getAttribute('id');
  });
  navLinks.forEach(link => {
    link.style.color = link.getAttribute('href') === '#' + current ? '#fff' : '';
  });
});

// ═══ INIT ═══
renderContracts('all');
runCalc();
