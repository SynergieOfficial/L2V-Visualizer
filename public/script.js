let ws;
let sacnTimeout;
const fixtureConfigs = {}; // Cache loaded configs

function connectWebSocket() {
  if (ws) ws.close();
  ws = new WebSocket(`ws://${location.host}`);

  ws.onopen = () => console.log('WebSocket connected');
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'update') {
      handleDMXUpdate(data.fixtures);
    }

    if (data.type === 'patch') {
      console.log('Received patch:', data.data);
      loadFixtures(data.data);
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

async function loadFixtures(patch) {
  const container = document.getElementById('fixture-container');
  container.innerHTML = '';

  for (const fixture of patch) {
    const wrapper = document.createElement('div');
    wrapper.id = fixture.id || `fixture-${fixture.address}`; // 🔥 New safe ID assignment!
    wrapper.dataset.address = fixture.address;
    wrapper.dataset.fixtureType = fixture.fixtureType;

    const templateUrl = `/fixtures/${fixture.fixtureType}/template.html`;
    const response = await fetch(templateUrl);
    const html = await response.text();
    wrapper.innerHTML = html;
    container.appendChild(wrapper);

    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = `/fixtures/${fixture.fixtureType}/style.css`;
    document.head.appendChild(style);

    if (!fixtureConfigs[fixture.fixtureType]) {
      const configUrl = `/fixtures/${fixture.fixtureType}/config.json`;
      const configResponse = await fetch(configUrl);
      const configData = await configResponse.json();
      fixtureConfigs[fixture.fixtureType] = configData;
    }
  }
}

function handleDMXUpdate(fixtures) {
  fixtures.forEach(fx => {
    console.log("Receiving DMX for fixture:", fx.fixtureType, "at address", fx.address, "DMX:", fx.dmx); // 🔥 Add this line
    const wrapper = document.getElementById(fx.id || `fixture-${fx.address}`);
    if (!wrapper) return;

    const config = fixtureConfigs[fx.fixtureType];
    if (!config || !config.attributes) return;

    const dmx = fx.dmx;

    config.attributes.forEach(attr => {
      const type = attr.type;
      const startCh = attr.channel - 1;
      const elements = attr.elements;

      elements.forEach(elementId => {
        const el = document.getElementById(elementId);
        if (!el) return;

        switch (type) {
          case 'intensity':
            if (dmx[startCh] !== undefined) {
              el.style.opacity = dmx[startCh] / 255;
            }
            break;
          case 'rgb':
            if (dmx[startCh] !== undefined && dmx[startCh+1] !== undefined && dmx[startCh+2] !== undefined) {
              const color = `rgb(${dmx[startCh]}, ${dmx[startCh+1]}, ${dmx[startCh+2]})`;
              el.style.backgroundColor = color;
            }
            break;
          case 'frost':
            if (dmx[startCh] !== undefined) {
              const frostOpacity = dmx[startCh] / 255 * 0.6;
              const currentColor = window.getComputedStyle(el).backgroundColor;
              el.style.boxShadow = `0px 0px 20px 15px ${currentColor.replace('rgb', 'rgba').replace(')', `,${frostOpacity})`)}`;
            }
            break;
        }
      });
    });
  });
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
    console.log('Waiting for Apply to connect to sACN.');
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
