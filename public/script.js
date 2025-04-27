let ws;
let patch = [];
let fixtureTypes = [];
let sacnConnected = false;

window.onload = () => {
  setupSettingsMenu();
  fetchFixtureTypes();
  loadPatch();
  fetchNICs();   // ← populate the NIC dropdown
  document.getElementById('add-fixture-btn')
          .addEventListener('click', addFixture);
  document.getElementById('save-patch-btn')
          .addEventListener('click', savePatchToDisk);

  document.getElementById('add-fixture-btn').addEventListener('click', addFixture);
  document.getElementById('save-patch-btn').addEventListener('click', savePatchToDisk);
};

function setupSettingsMenu() {
  const settingsIcon = document.getElementById('settings-icon');
  const settingsModal = document.getElementById('settings-modal');

  settingsIcon.addEventListener('click', () => {
    settingsModal.style.display = (settingsModal.style.display === 'block') ? 'none' : 'block';
  });

  setTimeout(() => {
    settingsIcon.classList.add('hidden');
  }, 5000);

  settingsIcon.addEventListener('mouseenter', () => {
    settingsIcon.classList.remove('hidden');
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

function loadPatch() {
  fetch('/patch/patch.json')        // lowercase “patch”
    .then(res => {
      if (!res.ok) throw new Error('Patch not found');
      return res.json();
    })
    .then(data => {
      patch = data;
      renderPatchTable();
      patch.forEach(({ fixtureType, address }) => {
        loadFixture(fixtureType, address);
      });
    })
    .catch(err => console.error('[Client] Failed to load patch.json:', err));
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
  }).catch(err => console.error(`[Client] Failed loading fixture ${type}:`, err));
}

function processDMXUpdate(fixtures) {
  fixtures.forEach(({ id, dmx }) => {
    const wrapper = document.getElementById(id);
    if (!wrapper) return;

    // zero-based start index for this fixture
    const base = parseInt(wrapper.dataset.address, 10) - 1;

    // parse config JSON
    let config = wrapper.dataset.config;
    if (typeof config === 'string') {
      config = JSON.parse(config);
    }

    // for each attribute, apply to the right DMX offset
    config.attributes.forEach(attr => {
      const type = attr.type.toLowerCase();
      // absolute index in the universe
      const idx  = base + (attr.channel - 1);

      attr.elements.forEach(elemId => {
        const el = wrapper.querySelector(`#${elemId}`);
        if (!el) return;

        if (type === 'rgb') {
          applyRGB(el, dmx.slice(idx, idx + 3));
        }
        else if (type === 'intensity') {
          applyIntensity(el, dmx[idx]);
        }
        else if (type === 'frost') {
          applyFrost(el, dmx[idx]);
        }
      });
    });
  });
}

function applyRGB(el, channels) {
  if (!channels) return;
  const [r, g, b] = channels;
  el.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
  el.style.boxShadow = `rgba(${r}, ${g}, ${b}, 0.5) 0px 0px 20px 15px`;
}

function applyIntensity(el, value) {
  if (value === undefined) return;
  el.style.opacity = value / 255;
}

function applyFrost(el, value) {
  if (value === undefined) return;
  el.style.filter = `blur(${value / 25}px)`;
}

function fetchNICs() {
  fetch('/nics')
    .then(res => res.json())
    .then(nics => {
      const nicSelect = document.getElementById('nic');
      nicSelect.innerHTML = '';
      nics.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n.address;
        opt.text  = `${n.name} (${n.address})`;
        nicSelect.appendChild(opt);
      });
    })
    .catch(err => console.error('[Client] Failed to fetch NICs:', err));
}
