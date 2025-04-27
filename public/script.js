// Corrected script.js according to repo state and current requirements

let ws;
let patch = [];
let fixtureTypes = [];
let sacnConnected = false;

window.onload = () => {
  fetchFixtureTypes();
  loadPatch();

  document.getElementById('settings-icon').addEventListener('mouseenter', () => {
    document.getElementById('settings-icon').classList.remove('hidden');
  });

  document.getElementById('settings-icon').addEventListener('mouseleave', () => {
    setTimeout(() => {
      document.getElementById('settings-icon').classList.add('hidden');
    }, 5000);
  });

  document.getElementById('add-fixture-btn').addEventListener('click', addFixture);
  document.getElementById('save-patch-btn').addEventListener('click', savePatchToDisk);
};

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
    } else if (data.type === 'nics') {
      populateNICDropdown(data.nics);
    }
  };
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
        option.innerText = type;
        select.appendChild(option);
      });
    });
}

function populateNICDropdown(nics) {
  const nicSelect = document.getElementById('nic');
  nicSelect.innerHTML = '';
  nics.forEach(nic => {
    const option = document.createElement('option');
    option.value = nic;
    option.textContent = nic;
    nicSelect.appendChild(option);
  });
}

function loadPatch() {
  fetch('/Patch/patch.json')
    .then(res => res.json())
    .then(data => {
      patch = data;
      renderPatchTable();
      patch.forEach(({ fixtureType, address }) => {
        loadFixture(fixtureType, address);
      });
    })
    .catch(err => {
      console.error('[Client] Failed to load patch.json:', err);
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

function renderPatchTable() {
  const tbody = document.getElementById('patch-list-body');
  tbody.innerHTML = '';
  patch.forEach(({ fixtureType, address }) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${fixtureType}</td><td>${address}</td>`;
    tbody.appendChild(row);
  });
}

function savePatchToDisk() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'save', patch }));
  }
}

function updateStatus(connected) {
  sacnConnected = connected;
  const status = document.getElementById('sacn-status');
  status.innerHTML = connected ? 'Status: 🟢 Connected' : 'Status: 🔴 Waiting';
}

function loadFixture(type, address) {
  Promise.all([
    fetch(`/fixtures/${type}/template.html`).then(res => res.text()),
    fetch(`/fixtures/${type}/style.css`).then(res => res.text()),
    fetch(`/fixtures/${type}/config.json`).then(res => res.json())
  ]).then(([html, css, config]) => {
    const container = document.getElementById('fixture-container');
    const wrapper = document.createElement('div');
    wrapper.id = `fixture-${address}`;
    wrapper.dataset.address = address;
    wrapper.dataset.fixtureType = type;
    wrapper.dataset.config = JSON.stringify(config);
    wrapper.innerHTML = html;
    container.appendChild(wrapper);

    const style = document.createElement('style');
    style.innerHTML = css;
    document.head.appendChild(style);
  }).catch(err => console.error('[Client] Failed to load fixture:', err));
}

function processDMXUpdate(fixtures) {
  fixtures.forEach(({ id, dmx }) => {
    const wrapper = document.getElementById(id);
    if (!wrapper) return;
    const config = JSON.parse(wrapper.dataset.config || '{}');

    config.attributes?.forEach(attr => {
      if (attr.type === 'RGB') {
        applyRGB(wrapper.querySelector(`#${attr.elementId}`), dmx.slice(attr.startChannel - 1, attr.startChannel + 2));
      } else if (attr.type === 'Intensity') {
        applyIntensity(wrapper.querySelector(`#${attr.elementId}`), dmx[attr.startChannel - 1]);
      } else if (attr.type === 'Frost') {
        applyFrost(wrapper.querySelector(`#${attr.elementId}`), dmx[attr.startChannel - 1]);
      }
    });
  });
}

function applyRGB(el, channels) {
  if (!el || !channels) return;
  const [r, g, b] = channels;
  el.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
  el.style.boxShadow = `rgba(${r}, ${g}, ${b}, 0.5) 0px 0px 20px 15px`;
}

function applyIntensity(el, value) {
  if (!el || value === undefined) return;
  el.style.opacity = value / 255;
}

function applyFrost(el, value) {
  if (!el || value === undefined) return;
  el.style.filter = `blur(${value / 25}px)`;
}