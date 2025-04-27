// public/script.js

let ws;
let sacnTimeout;
let patch = [];
const fixtureConfigs = {}; // Store configs per fixture

function connectWebSocket() {
  if (ws) ws.close();
  ws = new WebSocket(`ws://${location.host}`);

  ws.onopen = () => console.log('WebSocket connected');

  ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'update') {
      for (const fx of data.fixtures) {
        const wrapper = document.getElementById(fx.id);
        if (!wrapper) continue;

        const config = fixtureConfigs[fx.id];
        if (!config) continue;

        for (const attribute of config.attributes) {
          const el = wrapper.querySelector(`#${attribute.element}`);
          if (!el) continue;

          const ch = attribute.channels;

          if (attribute.type === 'Intensity' && fx.dmx[ch[0]] !== undefined) {
            el.style.opacity = fx.dmx[ch[0]] / 255;
          }

          if (attribute.type === 'RGB' && fx.dmx[ch[0]] !== undefined) {
            const r = fx.dmx[ch[0]] || 0;
            const g = fx.dmx[ch[1]] || 0;
            const b = fx.dmx[ch[2]] || 0;
            el.style.backgroundColor = `rgb(${r},${g},${b})`;
          }

          if (attribute.type === 'Intensity+RGB' && fx.dmx[ch[0]] !== undefined) {
            const intensity = fx.dmx[ch[0]] || 0;
            const r = fx.dmx[ch[1]] || 0;
            const g = fx.dmx[ch[2]] || 0;
            const b = fx.dmx[ch[3]] || 0;
            el.style.backgroundColor = `rgb(${r},${g},${b})`;
            el.style.opacity = intensity / 255;
          }

          if (attribute.type === 'Frost' && fx.dmx[ch[0]] !== undefined) {
            const frostValue = fx.dmx[ch[0]] || 0;
            const frostOpacity = frostValue / 255 * 0.6;
            const currentColor = window.getComputedStyle(el).backgroundColor;
            el.style.boxShadow = `0px 0px 20px 15px ${currentColor.replace('rgb', 'rgba').replace(')', `,${frostOpacity})`)}`;
          }
        }
      }
    }

    if (data.type === 'dmx_heartbeat') {
      document.getElementById('sacn-status').innerHTML = data.status === 'connected' ? 'Status: 🟢 Connected' : 'Status: 🔴 Waiting';
      clearTimeout(sacnTimeout);
      if (data.status === 'connected') {
        sacnTimeout = setTimeout(() => {
          document.getElementById('sacn-status').innerHTML = 'Status: 🔴 Waiting';
        }, 3000);
      }
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
    loadPatch();
  });
}

async function loadPatch() {
  const res = await fetch('/patch/patch.json');
  patch = await res.json();

  const container = document.getElementById('fixture-container');
  container.innerHTML = '';

  for (const fixture of patch) {
    await loadFixture(fixture);
  }

  renderPatchTable();
}

async function loadFixture(fixture) {
  const container = document.getElementById('fixture-container');

  const templateUrl = `/fixtures/${fixture.fixtureType}/template.html`;
  const configUrl = `/fixtures/${fixture.fixtureType}/config.json`;

  const [templateRes, configRes] = await Promise.all([
    fetch(templateUrl),
    fetch(configUrl)
  ]);

  const html = await templateRes.text();
  const config = await configRes.json();

  const wrapper = document.createElement('div');
  wrapper.id = fixture.id || `fixture-${fixture.address}`;
  wrapper.dataset.address = fixture.address;
  wrapper.dataset.fixtureType = fixture.fixtureType;
  wrapper.innerHTML = html;

  container.appendChild(wrapper);

  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = `/fixtures/${fixture.fixtureType}/style.css`;
  document.head.appendChild(style);

  fixtureConfigs[wrapper.id] = config; // Fixed: load config for each fixture at startup
}

function renderPatchTable() {
  const tbody = document.getElementById('patch-list-body');
  tbody.innerHTML = '';
  patch.forEach(fx => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${fx.fixtureType}</td><td>${fx.address}</td>`;
    tbody.appendChild(tr);
  });
}

async function addFixture() {
  const type = document.getElementById('fixture-type-select').value;
  const address = parseInt(document.getElementById('fixture-address-input').value, 10);
  if (!type || isNaN(address)) return;

  patch.push({ fixtureType: type, address });

  await fetch('/patch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });

  await loadFixture({ fixtureType: type, address });
  renderPatchTable();
}

function savePatch() {
  fetch('/save-patch', {
    method: 'POST'
  });
}

// Initialization
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
    return fetch('/fixtures');
  })
  .then(res => res.json())
  .then(fixtures => {
    const fixtureSelect = document.getElementById('fixture-type-select');
    fixtures.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      fixtureSelect.appendChild(opt);
    });
    return fetch('/config');
  })
  .then(res => res.json())
  .then(config => {
    if (config.nic) document.getElementById('nic').value = config.nic;
    if (config.universe) document.getElementById('universe').value = config.universe;
    loadPatch();
  });

document.getElementById('add-fixture-btn').addEventListener('click', addFixture);
document.getElementById('save-patch-btn').addEventListener('click', savePatch);

document.getElementById('settings-icon').addEventListener('click', () => {
  const modal = document.getElementById('settings-modal');
  modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
});
