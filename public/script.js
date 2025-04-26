let ws;
let sacnTimeout;
const fixtureConfigs = {}; // cache loaded configs

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

function loadFixtures(patch) {
  const container = document.getElementById('fixture-container');
  container.innerHTML = '';

  patch.forEach(async fixture => {
    const wrapper = document.createElement('div');
    wrapper.id = fixture.id;
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

    // Preload fixture config
    if (!fixtureConfigs[fixture.fixtureType]) {
      const configUrl = `/fixtures/${fixture.fixtureType}/config.json`;
      const configResponse = await fetch(configUrl);
      const configData = await configResponse.json();
      fixtureConfigs[fixture.fixtureType] = configData;
    }
  });
}

function handleDMXUpdate(fixtures) {
  fixtures.forEach(fx => {
    const wrapper = document.getElementById(fx.id);
    if (!wrapper) return;

    const config = fixtureConfigs[fx.fixtureType];
    if (!config) return; // No config loaded yet

    const dmx = fx.dmx;

    // Intensity
    if (config.channels?.intensity) {
      const intensityChannel = config.channels.intensity - 1;
      const main = wrapper.querySelector('[data-element="main"]');
      if (main && dmx.length > intensityChannel) {
        main.style.opacity = dmx[intensityChannel] / 255;
      }
    }

    // Frost (adds glow)
    if (config.channels?.frost) {
      const frostChannel = config.channels.frost - 1;
      const frostOpacity = dmx[frostChannel] / 255 * 0.6;

      const glowTargets = wrapper.querySelectorAll('[data-element="frost-target"]');
      glowTargets.forEach(target => {
        const currentColor = window.getComputedStyle(target).backgroundColor;
        target.style.boxShadow = `0px 0px 20px 15px ${currentColor.replace('rgb', 'rgba').replace(')', `,${frostOpacity})`)}`;
      });
    }

    // RGB attributes
    for (const key of Object.keys(config.channels)) {
      if (key.includes('rgb')) {
        const [rCh, gCh, bCh] = config.channels[key].map(c => c - 1);
        const element = wrapper.querySelector(`[data-element="${key}"]`);
        if (element && dmx.length > bCh) {
          const color = `rgb(${dmx[rCh]}, ${dmx[gCh]}, ${dmx[bCh]})`;
          element.style.backgroundColor = color;
        }
      }
    }

    // Beam Intensities
    if (config.channels?.beam_intensities) {
      config.channels.beam_intensities.forEach((channel, index) => {
        const beam = wrapper.querySelector(`[data-element="beam-${index + 1}"]`);
        if (beam && dmx.length >= channel) {
          const intensity = dmx[channel - 1];
          beam.style.opacity = intensity / 255;
        }
      });
    }
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