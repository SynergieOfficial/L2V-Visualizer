let ws;
let sacnTimeout;

function connectWebSocket() {
  if (ws) ws.close();
  ws = new WebSocket(`ws://${location.host}`);

  ws.onopen = () => console.log('WebSocket connected');
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'update') {
      data.fixtures.forEach(fx => {
        if (fx.id === "fixture1") {
          const el = document.getElementById(fx.id);
          if (!el) return;
          if (fx.dmx.length >= 3) {
            el.style.backgroundColor = `rgb(${fx.dmx[0]}, ${fx.dmx[1]}, ${fx.dmx[2]})`;
          }
        }

        if (fx.id === "fixture2") {
          const frostValue = fx.dmx[0] || 0;
          const frostOpacity = frostValue / 255 * 0.6;

          const plate1 = document.getElementById('BOLT1C-Plate-1');
          const plate2 = document.getElementById('BOLT1C-Plate-2');
          const main = document.getElementById('BOLT1C-Main');
          if (main && fx.dmx.length >= 2) {
            main.style.opacity = fx.dmx[1] / 255;
          }
          if (plate1 && fx.dmx.length >= 11) {
            const color = `rgb(${fx.dmx[8]}, ${fx.dmx[9]}, ${fx.dmx[10]})`;
            plate1.style.backgroundColor = color;
            plate1.style.boxShadow = `0px 0px 20px 15px ${color.replace('rgb', 'rgba').replace(')', `,${frostOpacity})`)}`;
          }
          if (plate2 && fx.dmx.length >= 15) {
            const color = `rgb(${fx.dmx[12]}, ${fx.dmx[13]}, ${fx.dmx[14]})`;
            plate2.style.backgroundColor = color;
            plate2.style.boxShadow = `0px 0px 20px 15px ${color.replace('rgb', 'rgba').replace(')', `,${frostOpacity})`)}`;
          }

          for (let i = 0; i < 16; i++) {
            const beam = document.getElementById(`BOLT1C-Beam-${i + 1}`);
            if (beam && fx.dmx.length >= (16 + i + 1)) {
              const intensity = fx.dmx[16 + i];
              beam.style.opacity = intensity / 255;
              const currentColor = window.getComputedStyle(beam).backgroundColor;
              beam.style.boxShadow = `0px 0px 20px 15px ${currentColor.replace('rgb', 'rgba').replace(')', `,${frostOpacity})`)}`;
            }
          }
        }
      });
    }

    if (data.type === 'dmx_heartbeat') {
      document.getElementById('sacn-status').innerHTML = 'Status: 🟢 Connected';
      clearTimeout(sacnTimeout);
      sacnTimeout = setTimeout(() => {
        document.getElementById('sacn-status').innerHTML = 'Status: 🔴 Waiting';
      }, 3000);
    }
  };
}

function applySettings() {
  const nic = document.getElementById('nic').value;
  const universe = document.getElementById('universe').value;
  fetch('/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nic, universe })
  }).then(() => {
    connectWebSocket();
  });
}

function loadAllFixtures() {
  fetch('/fixtures/BOLT1C/template.html')
    .then(res => res.text())
    .then(html => {
      document.getElementById("fixture2").innerHTML = html;
    });

  const boltStyle = document.createElement('link');
  boltStyle.rel = "stylesheet";
  boltStyle.href = "/fixtures/BOLT1C/style.css";
  document.head.appendChild(boltStyle);
}

fetch('/nics')
  .then(res => res.json())
  .then(nics => {
    const nicSelect = document.getElementById('nic');
    nics.forEach(nic => {
      const opt = document.createElement('option');
      opt.value = nic.address;
      opt.textContent = `${nic.name} (${nic.address})`;
      nicSelect.appendChild(opt);
    });
    return fetch('/config');
  })
  .then(res => res.json())
  .then(config => {
    if (config.nic) document.getElementById('nic').value = config.nic;
    if (config.universe) document.getElementById('universe').value = config.universe;
    loadAllFixtures();
    console.log('Fixtures loaded. Waiting for Apply.');
  });

const icon = document.getElementById('settings-icon');
const modal = document.getElementById('settings-modal');
let hideTimer;
function resetHideTimer() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => icon.classList.add('hidden'), 5000);
}
icon.addEventListener('click', () => {
  modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
  resetHideTimer();
});
icon.addEventListener('mouseover', () => {
  icon.classList.remove('hidden');
  resetHideTimer();
});
document.body.addEventListener('mousemove', resetHideTimer);
resetHideTimer();