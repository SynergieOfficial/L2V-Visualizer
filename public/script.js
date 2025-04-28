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
  fetch('/patch/patch.json')
    .then(res => res.json())
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
  const type    = document.getElementById('fixture-type-select').value;
  const address = parseInt(document.getElementById('fixture-address-input').value);
  if (!type || isNaN(address)) return;

  // 1) update client patch
  patch.push({ fixtureType: type, address });
  renderPatchTable();
  loadFixture(type, address);

  // 2) immediately tell the server about this new fixture
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'save', patch }));
  }
}

function renderPatchTable() {
  const tbody = document.getElementById('patch-list-body');
  tbody.innerHTML = '';

  patch.forEach(({ fixtureType, address }, i) => {
    const tr = document.createElement('tr');

    // Fixture type
    const tdType = document.createElement('td');
    tdType.textContent = fixtureType;
    tr.appendChild(tdType);

    // Start address (click→edit)
    const tdAddr = document.createElement('td');
    tdAddr.textContent = address;
    tdAddr.classList.add('editable-address');
    tdAddr.dataset.index = i;
    tr.appendChild(tdAddr);

    // Action (remove)
    const tdAction = document.createElement('td');
    const btn = document.createElement('button');
    btn.textContent = '🗑';
    btn.title = 'Remove fixture';
    btn.dataset.index = i;
    btn.addEventListener('click', () => removeFixture(i));
    tdAction.appendChild(btn);
    tr.appendChild(tdAction);

    tbody.appendChild(tr);
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

    // zero-based DMX start index for this fixture
    const base = parseInt(wrapper.dataset.address, 10) - 1;

    let config = wrapper.dataset.config;
    if (typeof config === 'string') {
      config = JSON.parse(config);
    }

    config.attributes.forEach(attr => {
      // absolute DMX index in the universe
      const idx = base + (attr.channel - 1);
      const type = attr.type.toLowerCase();

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
  // set the fill color…
  el.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
  // …but remove any Box-Shadow glow (frost is handled separately)
  el.style.boxShadow = '';
}

function applyIntensity(el, value) {
  if (value === undefined) return;
  el.style.opacity = value / 255;
}

function applyFrost(el, value) {
  // value undefined or zero? clear any frost/glow entirely
  if (value === undefined || value <= 0) {
    el.style.filter = '';
    return;
  }
  // otherwise map 1–255 → 0.04px–10px blur (255/25 ≈ 10px)
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

document.getElementById('patch-list-body')
  .addEventListener('click', e => {
    const td = e.target;
    if (!td.classList.contains('editable-address')) return;

    const i = parseInt(td.dataset.index, 10);
    const current = patch[i].address;
    td.innerHTML = `<input type="number" min="1" value="${current}" data-index="${i}" />`;

    const input = td.querySelector('input');
    input.focus();

    // Commit on blur or Enter
    input.addEventListener('blur', commitAddressEdit);
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') input.blur();
    });
  });

function commitAddressEdit(e) {
  const input = e.target;
  const i = parseInt(input.dataset.index, 10);
  const newAddr = parseInt(input.value, 10);

  if (!isNaN(newAddr) && newAddr > 0) {
    patch[i].address = newAddr;
    // Save & rerender
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'save', patch }));
    }
  }
  renderPatchTable();
  rerenderFixtures();
}

function rerenderFixtures() {
  const container = document.getElementById('fixture-container');
  container.innerHTML = '';
  patch.forEach(({ fixtureType, address }) => {
    loadFixture(fixtureType, address);
  });
}