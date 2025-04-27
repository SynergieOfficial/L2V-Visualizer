// Full corrected script.js based on latest repo and all recent findings

let ws;
let fixtureConfigs = {}; // Map of fixture IDs to their config

// Utility to fetch JSON safely
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

// Utility to fetch text (for templates)
async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.text();
}

// Load a fixture by fixtureType and fixtureID
async function loadFixture(fixtureType, fixtureID, address) {
  const container = document.getElementById('fixture-container');

  const wrapper = document.createElement('div');
  wrapper.id = fixtureID;
  wrapper.dataset.address = address;
  wrapper.dataset.fixtureType = fixtureType;

  // Load HTML
  const html = await fetchText(`/fixtures/${fixtureType}/template.html`);
  wrapper.innerHTML = html;

  container.appendChild(wrapper);

  // Load CSS
  const cssId = `css-${fixtureType}`;
  if (!document.getElementById(cssId)) {
    const link = document.createElement('link');
    link.id = cssId;
    link.rel = 'stylesheet';
    link.href = `/fixtures/${fixtureType}/style.css`;
    document.head.appendChild(link);
  }

  // Load Config
  const config = await fetchJSON(`/fixtures/${fixtureType}/config.json`);
  fixtureConfigs[fixtureID] = config;
}

// Render initial patch
async function loadPatch(fixtures) {
  for (const { fixtureType, address } of fixtures) {
    const fixtureID = `fixture-${address}`;
    await loadFixture(fixtureType, fixtureID, address);
  }
}

// Fill fixture type dropdown
async function loadFixtureTypes() {
  const res = await fetch('/fixtures');
  const types = await res.json();

  const select = document.getElementById('fixture-type-select');
  select.innerHTML = '';

  types.forEach(type => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    select.appendChild(option);
  });
}

// Render patch list
function renderPatchList(fixtures) {
  const tbody = document.getElementById('patch-list-body');
  tbody.innerHTML = '';

  fixtures.forEach(({ fixtureType, address }) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${fixtureType}</td><td>${address}</td>`;
    tbody.appendChild(tr);
  });
}

// Save patch to server
async function savePatch(fixtures) {
  await fetch('/save-patch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fixtures),
  });
}

// Apply NIC/universe settings
function applySettings() {
  const nic = document.getElementById('nic').value;
  const universe = parseInt(document.getElementById('universe').value);
  ws.send(JSON.stringify({ type: 'settings', nic, universe }));
}

// Add fixture from UI
async function addFixture() {
  const fixtureType = document.getElementById('fixture-type-select').value;
  const address = parseInt(document.getElementById('fixture-address-input').value);
  if (!fixtureType || isNaN(address)) return;

  const newFixture = { fixtureType, address };
  outputFixtures.push(newFixture);

  await loadFixture(fixtureType, `fixture-${address}`, address);
  renderPatchList(outputFixtures);
}

// WebSocket init
function initWebSocket() {
  ws = new WebSocket(`ws://${location.host}`);

  ws.onopen = () => {
    console.log('[Client] WebSocket connected');
  };

  ws.onmessage = async (msg) => {
    const data = JSON.parse(msg.data);

    if (data.type === 'patch') {
      outputFixtures = data.fixtures;
      await loadPatch(outputFixtures);
      renderPatchList(outputFixtures);
      await loadFixtureTypes();
    }

    if (data.type === 'update') {
      console.log('[Client] Received update DMX frame:', data.frames);
      applyDMX(data.frames);
    }
  };
}

// DMX Application
function applyDMX(frames) {
  frames.forEach(({ fixtureID, channels }) => {
    console.log(`[Client] Processing fixture ID: ${fixtureID}`);

    const el = document.getElementById(fixtureID);
    const config = fixtureConfigs[fixtureID];

    if (!el || !config) {
      console.warn(`[Client] Missing element or config for ${fixtureID}`);
      return;
    }

    for (const attr of config.attributes) {
      const { type, element, channels: attrChannels } = attr;
      const target = el.querySelector(`#${element}`);

      console.log(`[Client] Applying ${type} to element ${element} with channels ${attrChannels}`);

      if (!target) continue;

      if (type === 'Intensity') {
        const value = channels[attrChannels[0]] / 255;
        target.style.opacity = value;
      } else if (type === 'RGB') {
        const [r, g, b] = attrChannels.map(c => channels[c]);
        target.style.backgroundColor = `rgb(${r},${g},${b})`;
      } else if (type === 'Frost') {
        const frostValue = channels[attrChannels[0]] / 255;
        target.style.boxShadow = `0 0 20px 15px rgba(255,255,255,${frostValue})`;
      }
    }
  });
}

// Init
window.onload = () => {
  initWebSocket();

  document.getElementById('apply-settings').onclick = applySettings;
  document.getElementById('add-fixture-btn').onclick = addFixture;
  document.getElementById('save-patch-btn').onclick = () => savePatch(outputFixtures);
};
