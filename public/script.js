// script.js

let ws;
let sacnTimeout;
let localPatch = [];
const fixtureConfigs = {};

function connectWebSocket() {
  if (ws) ws.close();
  ws = new WebSocket(`ws://${location.host}`);

  ws.onopen = () => console.log('WebSocket connected');
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'update') {
      handleDMXUpdate(data.fixtures);
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

function handleDMXUpdate(fixtures) {
  fixtures.forEach(fx => {
    const wrapper = document.getElementById(fx.id || `fixture-${fx.address}`);
    if (!wrapper) return;

    const fixtureType = wrapper.dataset.fixtureType;
    const config = fixtureConfigs[fixtureType];
    if (!config) return;

    config.attributes.forEach(attr => {
      const value = fx.dmx[attr.channel - 1] || 0;
      attr.elements.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        if (attr.type === 'rgb') {
          const r = fx.dmx[attr.channel - 1] || 0;
          const g = fx.dmx[attr.channel] || 0;
          const b = fx.dmx[attr.channel + 1] || 0;
          el.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
        }

        if (attr.type === 'intensity') {
          el.style.opacity = value / 255;
        }

        if (attr.type === 'intensity_rgb') {
          const intensity = fx.dmx[attr.channel - 1] || 0;
          const r = fx.dmx[attr.channel] || 0;
          const g = fx.dmx[attr.channel + 1] || 0;
          const b = fx.dmx[attr.channel + 2] || 0;
          el.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
          el.style.opacity = intensity / 255;
        }

        if (attr.type === 'frost') {
          const opacity = value / 255 * 0.6;
          const currentColor = window.getComputedStyle(el).backgroundColor;
          el.style.boxShadow = `0px 0px 20px 15px ${currentColor.replace('rgb', 'rgba').replace(')', `,${opacity})`)}`;
        }
      });
    });
  });
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

async function loadFixture(fixture) {
  const container = document.getElementById('fixture-container');

  const wrapper = document.createElement('div');
  wrapper.id = fixture.id || `fixture-${fixture.address}`;
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

  const configUrl = `/fixtures/${fixture.fixtureType}/config.json`;
  const configRes = await fetch(configUrl);
  const config = await configRes.json();
  fixtureConfigs[fixture.fixtureType] = config;
}

async function loadFixtures(patch) {
  const container = document.getElementById('fixture-container');
  container.innerHTML = '';
  for (const fixture of patch) {
    await loadFixture(fixture);
  }
}

function fetchFixtureTypes() {
  fetch('/fixtures')
    .then(res => res.json())
    .then(fixtureTypes => {
      const select = document.getElementById('fixture-type-select');
      fixtureTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        select.appendChild(option);
      });
    });
}

function updatePatchListTable() {
  const tbody = document.getElementById('patch-list-body');
  tbody.innerHTML = '';
  localPatch.forEach(fixture => {
    const row = document.createElement('tr');
    const typeCell = document.createElement('td');
    const addressCell = document.createElement('td');
    typeCell.textContent = fixture.fixtureType;
    addressCell.textContent = fixture.address;
    row.appendChild(typeCell);
    row.appendChild(addressCell);
    tbody.appendChild(row);
  });
}

function addFixtureToPatch() {
  const type = document.getElementById('fixture-type-select').value;
  const address = parseInt(document.getElementById('fixture-address-input').value, 10);

  if (!type || isNaN(address) || address <= 0) {
    alert('Please select a fixture type and enter a valid address.');
    return;
  }

  const fixture = {
    fixtureType: type,
    address: address,
    id: `fixture-${address}`
  };

  localPatch.push(fixture);

  loadFixture(fixture);
  updatePatchListTable();
}

document.getElementById('add-fixture-btn').addEventListener('click', addFixtureToPatch);

// Initial Setup
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
    connectWebSocket();
  });

fetch('/patch/patch.json')
  .then(res => res.json())
  .then(patch => {
    localPatch = patch;
    loadFixtures(patch);
    updatePatchListTable();
  });

fetchFixtureTypes();

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