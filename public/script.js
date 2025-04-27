// Fully integrated and fixed script.js for L2V-Visualizer (Scope 0.5.11 Patch Final)

let ws;
let patch = [];
let fixtureTypes = [];
let sacnConnected = false;

window.onload = () => {
  setupSettingsMenu();
  fetchFixtureTypes();
  loadPatch();

  document.getElementById('add-fixture-btn').addEventListener('click', addFixture);
  document.getElementById('save-patch-btn').addEventListener('click', savePatchToDisk);
};

function setupSettingsMenu() {
  const settingsIcon = document.getElementById('settings-icon');
  const settingsModal = document.getElementById('settings-modal');

  settingsIcon.addEventListener('mouseenter', () => {
    settingsIcon.classList.remove('hidden');
  });

  settingsIcon.addEventListener('mouseleave', () => {
    setTimeout(() => settingsIcon.classList.add('hidden'), 5000);
  });

  settingsIcon.addEventListener('click', () => {
    settingsModal.style.display = settingsModal.style.display === 'block' ? 'none' : 'block';
  });
}

function applySettings() {
  const nic = document.getElementById('nic').value;
  const universe = document.getElementById('universe').value;

  if (ws) ws.close();

  ws = new WebSocket(`ws://${location.host}`);

  ws.onopen = () => {
    console.log('[Client] WebSocket connected');
    ws.send(JSON.stringify({ type: 'connect', nic, universe }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'status') {
      updateStatus(data.connected);
    } else if (data.type === 'update') {
      processDMXUpdate(data.fixtures);
    }
  };
}

function updateStatus(connected) {
  sacnConnected = connected;
  const statusEl = document.getElementById('sacn-status');
  statusEl.innerHTML = connected ? 'Status: 🟢 Connected' : 'Status: 🔴 Waiting';
}

function fetchFixtureTypes() {
  fetch('/fixtures/')
    .then(res => res.json())
    .then(types => {
      fixtureTypes = types;
      const select = document.getElementById('fixture-type-select');
      select.innerHTML = '';
      types.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        select.appendChild(option);
      });
    })
    .catch(err => console.error('[Client] Failed to fetch fixture types:', err));
}

function loadPatch() {
  fetch('/patch.json')
    .then(res => res.json())
    .then(data => {
      patch = data;
      renderPatchTable();
      patch.forEach(fixture => loadFixture(fixture.fixtureType, fixture.address));
    })
    .catch(err => console.error('[Client] Failed to load patch.json:', err));
}

function renderPatchTable() {
  const tbody = document.getElementById('patch-list-body');
  tbody.innerHTML = '';
  patch.forEach(({ fixtureType, address }) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${fixtureType}</td><td>${address}</td>`;
    tbody.appendChild(row);
  });
}

function addFixture() {
  const type = document.getElementById('fixture-type-select').value;
  const address = parseInt(document.getElementById('fixture-address-input').value);
  if (!type || isNaN(address)) return;

  patch.push({ fixtureType: type, address });
  renderPatchTable();
  loadFixture(type, address);
}

function savePatchToDisk() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'save', patch }));
  }
}

function loadFixture(type, address) {
  Promise.all([
    fetch(`/fixtures/${type}/template.html`).then(res => res.text()),
    fetch(`/fixtures/${type}/style.css`).then(res => res.text()),
    fetch(`/fixtures/${type}/config.json`).then(res => res.json())
  ]).then(([html, css, config]) => {
    const container = document.getElementById('fixture-container');
    const fixtureWrapper = document.createElement('div');

    fixtureWrapper.id = `fixture-${address}`;
    fixtureWrapper.dataset.address = address;
    fixtureWrapper.dataset.fixtureType = type;
    fixtureWrapper.dataset.config = JSON.stringify(config);

    fixtureWrapper.innerHTML = html;
    container.appendChild(fixtureWrapper);

    const styleTag = document.createElement('style');
    styleTag.innerHTML = css;
    document.head.appendChild(styleTag);

    console.log(`[Client] Loaded fixture ${type} at address ${address}`);
  }).catch(err => console.error(`[Client] Failed loading fixture ${type}:`, err));
}

function processDMXUpdate(fixtures) {
  fixtures.forEach(({ id, dmx }) => {
    const fixtureEl = document.getElementById(id);
    if (!fixtureEl) return;

    const config = JSON.parse(fixtureEl.dataset.config || '{}');
    if (!config.attributes) return;

    config.attributes.forEach(attr => {
      if (attr.type === 'RGB') {
        const rgb = dmx.slice(attr.startChannel - 1, attr.startChannel + 2);
        applyRGB(fixtureEl, rgb);
      } else if (attr.type === 'Intensity') {
        const intensity = dmx[attr.startChannel - 1];
        applyIntensity(fixtureEl, intensity);
      } else if (attr.type === 'Frost') {
        const frost = dmx[attr.startChannel - 1];
        applyFrost(fixtureEl, frost);
      }
    });
  });
}

function applyRGB(el, [r, g, b]) {
  if (r === undefined || g === undefined || b === undefined) return;
  el.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
  el.style.boxShadow = `0 0 20px 15px rgba(${r}, ${g}, ${b}, 0.5)`;
}

function applyIntensity(el, value) {
  if (value === undefined) return;
  el.style.opacity = value / 255;
}

function applyFrost(el, value) {
  if (value === undefined) return;
  el.style.filter = `blur(${value / 25}px)`;
}
