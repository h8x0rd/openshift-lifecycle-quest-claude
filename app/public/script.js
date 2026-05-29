const stageScores = { local: 10, dev: 33, test: 66, prod: 100, production: 100 };
const stageLabels = { dev: 'Development', test: 'Test', prod: 'Production', production: 'Production' };

function confetti() {
  const colours = ['#71e3ff', '#b4ff7a', '#ffffff', '#ffcf70', '#ff7ad9'];
  for (let i = 0; i < 50; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colours[Math.floor(Math.random() * colours.length)];
    piece.style.animationDelay = `${Math.random() * 0.35}s`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 1900);
  }
}

async function refreshInfo() {
  const res = await fetch('/api/info');
  const info = await res.json();
  const env = String(info.environment || 'local').toLowerCase();
  const score = stageScores[env] || 20;

  document.getElementById('envBadge').textContent = stageLabels[env] || env;
  document.getElementById('message').textContent = info.message;
  document.getElementById('version').textContent = info.version;
  document.getElementById('hostname').textContent = info.hostname;
  document.getElementById('timestamp').textContent = new Date(info.timestamp).toLocaleTimeString();
  document.getElementById('meterFill').style.width = `${score}%`;
  document.getElementById('progressText').textContent = `${score}% through the release quest`;
  document.getElementById('gitopsCheck').checked = true;
  document.getElementById('syncCheck').checked = true;

  if (env === 'prod' || env === 'production') {
    document.documentElement.style.setProperty('--accent', '#ffcf70');
    document.documentElement.style.setProperty('--accent-2', '#b4ff7a');
  }
}

document.getElementById('launchButton').addEventListener('click', () => {
  const rocket = document.getElementById('rocket');
  rocket.classList.toggle('launch');
  confetti();
});

refreshInfo();
setInterval(refreshInfo, 10000);
