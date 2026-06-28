/* ═══════════════════════════════════════════════════════════════
   ARTIFACT VIRTUAL — DOCUMENTATION SITE
   Interactive Engine
   ═══════════════════════════════════════════════════════════════ */

// ═══ CONTRACT DATA ═══
const CONTRACTS = [
  { name: "Au Token", role: "Reserve token. 1B max supply, 9bps transfer tax.", cat: "token", addr: "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08" },
  { name: "Ag Token", role: "Governance token. 100M max, PID-minted, no fees.", cat: "token", addr: "0x1D31719389Bd8b17277Ba367c26b830aE34D3674" },
  { name: "TreasuryAMO", role: "AMO operations via Slipstream. Concentrated liquidity.", cat: "core", addr: "0x56653245f4718fe105b95C8424947B31b84b5188" },
  { name: "PID Controller", role: "Computes Ag emissions from TVL gap. Policy engine.", cat: "core", addr: "0x991138923880773D67c01392c31A255e770F7f70" },
  { name: "AvOracle v5", role: "Multi-source TWAP price feeds. Manipulation resistant.", cat: "oracle", addr: "0xb479760Dfd9Ba90cF670BBB1647a4B06B2032bdB" },
  { name: "Governor", role: "DAO governance. 100K threshold, 30-day voting, 4% quorum.", cat: "gov", addr: "0x259c1C2354Bc9e1eF20ee3B7b1D8580Cb5F06385" },
  { name: "Timelock", role: "48h delayed execution for governance security.", cat: "gov", addr: "0x662321CC63700865838aB08378061BE499344714" },
  { name: "RSBT", role: "Soulbound Receipt Token. Non-transferable staking multiplier.", cat: "token", addr: "0xfd0451a53834E4DAa9626A24B9Aa640B0d3647CD" },
  { name: "AcousticVault", role: "Treasury FlashBuy v2. Buyback engine.", cat: "core", addr: "0xf6383860837E6cb983F9Af8Def92fc08F15Be65b" },
];

// ═══ NAV ACTIVE STATE ═══
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

function updateActiveNav() {
  let current = '';
  sections.forEach(sec => {
    const top = sec.offsetTop - 100;
    if (window.scrollY >= top) current = sec.id;
  });
  navLinks.forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === '#' + current);
  });
}
window.addEventListener('scroll', updateActiveNav);

// ═══ HERO PARTICLES ═══
(function initHero() {
  const canvas = document.getElementById('hero-bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, particles = [];

  function resize() {
    w = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    h = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * (w / window.devicePixelRatio);
      this.y = Math.random() * (h / window.devicePixelRatio);
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = (Math.random() - 0.5) * 0.3;
      this.size = Math.random() * 2 + 0.5;
      this.alpha = Math.random() * 0.5 + 0.1;
      this.color = Math.random() > 0.7 ? '#FFD700' : (Math.random() > 0.5 ? '#C0C0C0' : '#ffffff');
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      const cw = w / window.devicePixelRatio;
      const ch = h / window.devicePixelRatio;
      if (this.x < 0 || this.x > cw) this.vx *= -1;
      if (this.y < 0 || this.y > ch) this.vy *= -1;
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = this.alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  resize();
  const count = Math.min(120, Math.floor((w * h) / 10000));
  for (let i = 0; i < count; i++) particles.push(new Particle());

  function animate() {
    const cw = w / window.devicePixelRatio;
    const ch = h / window.devicePixelRatio;
    ctx.clearRect(0, 0, cw, ch);
    particles.forEach(p => { p.update(); p.draw(); });

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(255,255,255,${0.03 * (1 - dist / 100)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(animate);
  }
  animate();
  window.addEventListener('resize', resize);
})();

// ═══ 3D ARCHITECTURE ═══
(function initArch3D() {
  if (typeof THREE === 'undefined') return;
  const canvas = document.getElementById('arch-3d');
  if (!canvas) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, canvas.offsetWidth / canvas.offsetHeight, 0.1, 100);
  camera.position.set(0, 2, 8);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  // Nodes
  const nodes = [
    { pos: [0, 0, 0], color: 0xFFD700, size: 0.5, label: "Treasury" },
    { pos: [-2.5, 1.5, 0], color: 0xC0C0C0, size: 0.35, label: "TreasuryAMO" },
    { pos: [2.5, 1.5, 0], color: 0x00D4FF, size: 0.35, label: "PID" },
    { pos: [0, 2.5, 0], color: 0xA855F7, size: 0.35, label: "Oracle" },
    { pos: [-2.5, -1.5, 0], color: 0xFF6B35, size: 0.35, label: "Governor" },
    { pos: [2.5, -1.5, 0], color: 0xFF6B35, size: 0.35, label: "Timelock" },
    { pos: [0, -2.5, 0], color: 0xFFD700, size: 0.3, label: "Au" },
    { pos: [-1.5, -2.5, 1], color: 0xC0C0C0, size: 0.3, label: "Ag" },
  ];

  const meshes = [];
  nodes.forEach(n => {
    const geo = new THREE.SphereGeometry(n.size, 32, 32);
    const mat = new THREE.MeshBasicMaterial({ color: n.color, transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...n.pos);
    mesh.userData = { label: n.label, baseColor: n.color };
    scene.add(mesh);
    meshes.push(mesh);

    // Glow
    const glowGeo = new THREE.SphereGeometry(n.size * 1.5, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({ color: n.color, transparent: true, opacity: 0.1 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(...n.pos);
    scene.add(glow);
  });

  // Connections
  const connections = [[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[4,5],[1,6],[2,7]];
  connections.forEach(([a, b]) => {
    const points = [new THREE.Vector3(...nodes[a].pos), new THREE.Vector3(...nodes[b].pos)];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.4 });
    scene.add(new THREE.Line(lineGeo, lineMat));
  });

  // Stars background
  for (let i = 0; i < 200; i++) {
    const sGeo = new THREE.SphereGeometry(0.02, 4, 4);
    const sMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: Math.random() * 0.5 + 0.1 });
    const star = new THREE.Mesh(sGeo, sMat);
    star.position.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 10 - 5);
    scene.add(star);
  }

  // Mouse rotation
  let mouseX = 0, mouseY = 0, isDragging = false, prevX = 0, prevY = 0;
  let rotX = 0, rotY = 0;

  canvas.addEventListener('mousedown', e => { isDragging = true; prevX = e.clientX; prevY = e.clientY; });
  canvas.addEventListener('mousemove', e => {
    if (!isDragging) return;
    rotY += (e.clientX - prevX) * 0.005;
    rotX += (e.clientY - prevY) * 0.005;
    prevX = e.clientX; prevY = e.clientY;
  });
  canvas.addEventListener('mouseup', () => isDragging = false);
  canvas.addEventListener('mouseleave', () => isDragging = false);

  canvas.addEventListener('wheel', e => {
    camera.position.z = Math.max(4, Math.min(15, camera.position.z + e.deltaY * 0.005));
  });

  function animate() {
    requestAnimationFrame(animate);
    if (!isDragging) rotY += 0.002;
    scene.rotation.x = rotX;
    scene.rotation.y = rotY;

    // Pulse nodes
    const t = Date.now() * 0.001;
    meshes.forEach((m, i) => {
      const scale = 1 + Math.sin(t * 2 + i) * 0.05;
      m.scale.setScalar(scale);
    });

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = canvas.offsetWidth / canvas.offsetHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
  });
})();

// ═══ FLYWHEEL ANIMATION ═══
const FW_STEPS = [
  { title: "TVL Grows", desc: "More deposits flow into the protocol. The Treasury swells. Total Value Locked increases toward the target." },
  { title: "PID Mints More Ag", desc: "The PID controller detects the TVL gap and increases Ag emissions. More Ag flows into the staking pools." },
  { title: "Higher Staking APY", desc: "More Ag distributed to stakers means higher yield. Capital efficiency increases. Staking becomes more attractive." },
  { title: "More Ag Demand", desc: "High APY attracts buyers. Ag purchase pressure increases. Price discovery finds new equilibrium." },
  { title: "More Liquidity", desc: "Capital flows into the ecosystem. More deposits. More TVL. The cycle reinforces — the flywheel spins faster." },
];

let fwInterval = null;
let fwCurrent = 0;

function fwShowStep(n) {
  fwCurrent = n;
  document.querySelectorAll('.fw-orbit-node').forEach(el => el.classList.remove('active'));
  const node = document.querySelector(`.fw-n${n + 1}`);
  if (node) node.classList.add('active');
  document.getElementById('fw-step-num').textContent = n + 1;
  document.getElementById('fw-step-title').textContent = FW_STEPS[n].title;
  document.getElementById('fw-step-desc').textContent = FW_STEPS[n].desc;
}

function fwAnimate() {
  if (fwInterval) return;
  let step = 0;
  fwShowStep(step);
  fwInterval = setInterval(() => {
    step = (step + 1) % 5;
    fwShowStep(step);
  }, 2000);
}

function fwReset() {
  if (fwInterval) { clearInterval(fwInterval); fwInterval = null; }
  document.querySelectorAll('.fw-orbit-node').forEach(el => el.classList.remove('active'));
  fwShowStep(0);
}

document.getElementById('fw-play')?.addEventListener('click', fwAnimate);
document.getElementById('fw-stop')?.addEventListener('click', fwReset);
fwShowStep(0);

// ═══ PID SIMULATOR ═══
let pidChart = null;

function pidCompute() {
  const kp = parseFloat(document.getElementById('sl-kp').value);
  const ki = parseFloat(document.getElementById('sl-ki').value);
  const kd = parseFloat(document.getElementById('sl-kd').value);
  const target = parseFloat(document.getElementById('sl-target').value);
  const current = parseFloat(document.getElementById('sl-current').value);

  const error = target - current;
  const pTerm = kp * error;
  const iTerm = ki * error * 0.5; // simplified integral
  const dTerm = kd * 0; // no change in static sim
  let output = pTerm + iTerm + dTerm;
  output = Math.max(0, Math.min(output, 50000));

  document.getElementById('sg-kp').textContent = kp.toFixed(2);
  document.getElementById('sg-ki').textContent = ki.toFixed(2);
  document.getElementById('sg-kd').textContent = kd.toFixed(2);
  document.getElementById('sg-target').textContent = '$' + target.toLocaleString();
  document.getElementById('sg-current').textContent = '$' + current.toLocaleString();
  document.getElementById('pid-live-output').textContent = '= ' + Math.round(output).toLocaleString() + ' Ag/epoch';

  return { output, error, target, current, kp, ki, kd };
}

function pidUpdateChart() {
  if (typeof Chart === 'undefined') return;
  const { target, current, kp, ki, kd } = pidCompute();

  // Simulate 50 epochs
  const labels = [];
  const data = [];
  let integral = 0;
  let prevError = target - current;
  let simTVL = current;

  for (let i = 0; i < 50; i++) {
    labels.push('E' + (i + 1));
    const error = target - simTVL;
    integral += error;
    const derivative = error - prevError;
    let emission = kp * error + ki * integral * 0.01 + kd * derivative;
    emission = Math.max(0, Math.min(emission, 50000));
    data.push(Math.round(emission));

    // TVL grows based on emission (simplified)
    simTVL += emission * 0.5;
    prevError = error;
  }

  const ctx = document.getElementById('pid-chart');
  if (!ctx) return;

  if (pidChart) pidChart.destroy();
  pidChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Ag Emission / Epoch',
        data,
        borderColor: '#00FF88',
        backgroundColor: 'rgba(0,255,136,0.05)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0a0a0a',
          borderColor: '#2a2a2a',
          borderWidth: 1,
          titleFont: { family: 'JetBrains Mono' },
          bodyFont: { family: 'JetBrains Mono' },
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: { color: '#666', font: { family: 'JetBrains Mono', size: 10 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: { color: '#666', font: { family: 'JetBrains Mono', size: 10 } },
        }
      }
    }
  });
}

['sl-kp','sl-ki','sl-kd','sl-target','sl-current'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', () => {
    pidCompute();
    pidUpdateChart();
  });
});

pidCompute();
pidUpdateChart();

// ═══ CONTRACT MAP ═══
function renderContracts(filter) {
  const container = document.getElementById('contracts-list');
  if (!container) return;
  container.innerHTML = '';

  const filtered = filter === 'all' ? CONTRACTS : CONTRACTS.filter(c => c.cat === filter);

  filtered.forEach(c => {
    const row = document.createElement('div');
    row.className = 'contract-row';
    row.innerHTML = `
      <div class="cr-name">${c.name}</div>
      <div class="cr-role">${c.role}</div>
      <div><span class="cr-tag tag-${c.cat}">${c.cat}</span></div>
      <a href="https://basescan.org/address/${c.addr}" target="_blank" class="cr-addr">${c.addr.slice(0,6)}...${c.addr.slice(-4)}</a>
    `;
    container.appendChild(row);
  });
}

document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    renderContracts(chip.dataset.filter);
  });
});

renderContracts('all');

// ═══ EMISSION CALCULATOR ═══
let calcChart = null;

function calcUpdate() {
  const target = parseFloat(document.getElementById('ci-target').value) || 0;
  const current = parseFloat(document.getElementById('ci-current').value) || 0;
  const kp = parseFloat(document.getElementById('ci-kp').value) || 0;
  const ki = parseFloat(document.getElementById('ci-ki').value) || 0;
  const epoch = parseInt(document.getElementById('ci-epoch').value) || 604800;

  const gap = target - current;
  const pTerm = kp * gap;
  let emission = Math.max(0, pTerm);
  const capped = Math.min(emission, 50000);

  // APY estimation
  let apy = 0;
  if (current > 0) {
    const yearlyEpochs = 31536000 / epoch;
    apy = ((capped * yearlyEpochs) / current) * 100;
  }

  document.getElementById('co-gap').textContent = '$' + gap.toLocaleString();
  document.getElementById('co-pterm').textContent = Math.round(pTerm).toLocaleString();
  document.getElementById('co-emission').textContent = Math.round(emission).toLocaleString() + ' Ag';
  document.getElementById('co-capped').textContent = Math.round(capped).toLocaleString() + ' Ag' + (emission > 50000 ? ' ⬆ capped' : '');
  document.getElementById('co-apy').textContent = apy > 0 ? apy.toFixed(1) + '%' : '—';

  // Chart
  if (typeof Chart === 'undefined') return;
  const labels = [];
  const data = [];
  let simTVL = current;
  let integral = 0;
  let prevError = gap;

  for (let i = 0; i < 30; i++) {
    labels.push('E' + (i + 1));
    const error = target - simTVL;
    integral += error;
    const derivative = error - prevError;
    let em = kp * error + ki * integral * 0.01;
    em = Math.max(0, Math.min(em, 50000));
    data.push(Math.round(em));
    simTVL += em * 0.5;
    prevError = error;
  }

  const ctx = document.getElementById('calc-chart');
  if (!ctx) return;

  if (calcChart) calcChart.destroy();
  calcChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Ag/Epoch',
        data,
        backgroundColor: data.map(v => v >= 50000 ? 'rgba(255,215,0,0.6)' : 'rgba(0,255,136,0.4)'),
        borderColor: data.map(v => v >= 50000 ? '#FFD700' : '#00FF88'),
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0a0a0a',
          borderColor: '#2a2a2a',
          borderWidth: 1,
          titleFont: { family: 'JetBrains Mono' },
          bodyFont: { family: 'JetBrains Mono' },
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#666', font: { family: 'JetBrains Mono', size: 9 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: { color: '#666', font: { family: 'JetBrains Mono', size: 10 } },
        }
      }
    }
  });
}

['ci-target','ci-current','ci-kp','ci-ki','ci-epoch'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', calcUpdate);
  document.getElementById(id)?.addEventListener('change', calcUpdate);
});

calcUpdate();

// ═══ SMOOTH SCROLL ═══
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// ═══ INTERSECTION OBSERVER FOR ANIMATIONS ═══
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.arch-card, .token-panel, .gov-step-card, .co-card, .gl-item').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
  observer.observe(el);
});
