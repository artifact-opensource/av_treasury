/* ═══════════════════════════════════════════════════════════════
   AV TREASURY — Documentation JS
   No gimmicks. Just functionality.
   ═══════════════════════════════════════════════════════════════ */

const CONTRACTS = [
  { name: "Artifact Utility (Au)", cat: "token", addr: "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08", role: "Reserve token, 9bps tax, 1B max" },
  { name: "Artifact Governance (Ag)", cat: "token", addr: "0x1D31719389Bd8b17277Ba367c26b830aE34D3674", role: "Governance token, PID-minted, 100M max" },
  { name: "RSBT", cat: "token", addr: "0xfd0451a53834E4DAa9626A24B9Aa640B0d3647CD", role: "Soulbound receipt, non-transferable" },
  { name: "TreasuryAMO", cat: "core", addr: "0x56653245f4718fe105b95C8424947B31b84b5188", role: "Reserve management, Slipstream liquidity" },
  { name: "PID Controller", cat: "policy", addr: "0x991138923880773D67c01392c31A255e770F7f70", role: "Ag emission computation from TVL gap" },
  { name: "AvOracle v5", cat: "policy", addr: "0xb479760Dfd9Ba90cF670BBB1647a4B06B2032bdB", role: "Multi-source TWAP price feeds" },
  { name: "GovernorContract", cat: "gov", addr: "0x259c1C2354Bc9e1eF20ee3B7b1D8580Cb5F06385", role: "Proposal creation, voting, execution" },
  { name: "ArtifactTimelock", cat: "gov", addr: "0x662321CC63700865838aB08378061BE499344714", role: "48h delayed execution" },
  { name: "TreasuryFlashBuy v2", cat: "mech", addr: "0xf6383860837E6cb983F9Af8Def92fc08F15Be65b", role: "Buyback engine using oracle data" },
];

// ═══ CONTRACTS LIST ═══
function renderContracts(filter = 'all') {
  const list = document.getElementById('contracts-list');
  const filtered = filter === 'all' ? CONTRACTS : CONTRACTS.filter(c => c.cat === filter);

  list.innerHTML = filtered.map(c => `
    <div class="contract-row" data-cat="${c.cat}">
      <div class="cr-name">${c.name}</div>
      <div class="cr-addr"><a href="https://basescan.org/address/${c.addr}" target="_blank">${c.addr.slice(0, 6)}...${c.addr.slice(-4)}</a></div>
      <div class="cr-role">${c.role}</div>
      <div class="cr-tag">${c.cat}</div>
    </div>
  `).join('');
}

document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    renderContracts(chip.dataset.filter);
  });
});

// ═══ EMISSION CALCULATOR ═══
function formatNum(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.round(n).toLocaleString();
}

function calcUpdate() {
  const target = parseFloat(document.getElementById('ci-target').value) || 0;
  const current = parseFloat(document.getElementById('ci-current').value) || 0;
  const kp = parseFloat(document.getElementById('ci-kp').value) || 0;
  const ki = parseFloat(document.getElementById('ci-ki').value) || 0;
  const epochSec = parseFloat(document.getElementById('ci-epoch').value) || 432000;
  const EMISSION_CAP = 50000;

  const gap = target - current;
  const pTerm = kp * gap;
  const rawEmission = Math.max(0, pTerm);
  const capped = Math.min(rawEmission, EMISSION_CAP);

  document.getElementById('co-gap').textContent = '$' + formatNum(gap);
  document.getElementById('co-pterm').textContent = formatNum(pTerm);
  document.getElementById('co-emission').textContent = formatNum(rawEmission) + ' Ag';
  document.getElementById('co-capped').textContent = formatNum(capped) + ' Ag';

  // APY estimate
  if (current > 0 && capped > 0) {
    const annualEpochs = (365 * 24 * 3600) / epochSec;
    const annualEmission = capped * annualEpochs;
    const apy = (annualEmission * 100) / (current * 0.0009); // rough: tax revenue as price proxy
    document.getElementById('co-apy').textContent = apy.toFixed(1) + '%';
  } else {
    document.getElementById('co-apy').textContent = '—';
  }

  updateChart(target, current, kp, ki, epochSec, EMISSION_CAP);
}

// ═══ CHART ═══
let chart = null;
function updateChart(target, current, kp, ki, epochSec, cap) {
  const ctx = document.getElementById('calc-chart');
  if (!ctx) return;

  const epochs = 20;
  const labels = [];
  const data = [];
  let tvl = current;
  let integral = 0;

  for (let i = 0; i < epochs; i++) {
    const gap = target - tvl;
    integral += gap * (epochSec / 86400);
    const emission = Math.min(Math.max(0, kp * gap + ki * integral), cap);
    labels.push('E' + (i + 1));
    data.push(Math.round(emission));
    // Simulate TVL response: higher emissions attract deposits
    tvl += emission * 100; // rough: each Ag attracts ~$100 TVL
    if (tvl > target) tvl = target;
  }

  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
  } else {
    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Ag Emitted per Epoch',
          data: data,
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderColor: 'rgba(255,255,255,0.3)',
          borderWidth: 1,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#666', font: { family: 'JetBrains Mono', size: 10 } }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#666', font: { family: 'JetBrains Mono', size: 10 } }
          }
        }
      }
    });
  }
}

// ═══ SCROLL SPY ═══
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 100) {
      current = sec.id;
    }
  });
  navLinks.forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === '#' + current);
  });
});

// ═══ INIT ═══
document.addEventListener('DOMContentLoaded', () => {
  renderContracts();
  calcUpdate();

  document.querySelectorAll('.calc-inputs input').forEach(input => {
    input.addEventListener('input', calcUpdate);
  });
});
