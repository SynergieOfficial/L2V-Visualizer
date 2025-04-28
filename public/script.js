let ws;
let patch = []; // each item: { fixtureType, address, universe }
let fixtureTypes = [];
let sacnConnected = false;
let pencilMode = false;
let pencilIdx  = null;

const fixtureConfigs = {};

//console.log('[Client] script.js loaded');

window.onload = () => {
  setupSettingsMenu();
  fetchNICs();
  fetchFixtureTypes();
  loadPatch();

  document.getElementById('add-fixture-btn')
          .addEventListener('click', addFixture);
  document.getElementById('save-patch-btn')
          .addEventListener('click', savePatchToDisk);
};

let disconnectTimer;
const DISCONNECT_TIMEOUT = 5000;

/**
 * Update the sACN status indicator.
 */
function updateStatus(connected) {
  const el = document.getElementById('sacn-status');
  el.textContent = connected
    ? 'Status: 🟢 Connected'
    : 'Status: 🔴 Disconnected';
}

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
  console.log('[Client] applySettings() called; NIC =', nic);

  // — if there’s already an open WS, just tell it to switch NIC
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'connect', nic }));
    return;
  }

  // — otherwise create it once
  ws = new WebSocket(`ws://${location.host}`);
  ws.onopen = () => {
    console.log('[Client] WebSocket connected');
    ws.send(JSON.stringify({ type: 'connect', nic }));
    // start the 5s “no‐data” timeout
    updateStatus(false);
    clearTimeout(disconnectTimer);
    disconnectTimer = setTimeout(() => updateStatus(false), DISCONNECT_TIMEOUT);
  };

  ws.onmessage = (event) => {
    //console.log('[Client] ws.onmessage raw payload →', event.data);
    const data = JSON.parse(event.data);
    //console.log('[Client] ws.onmessage parsed →', data);

    if (data.type === 'status') {
      // server connection ack
      updateStatus(data.connected);

    } else if (data.type === 'update') {
      // mark alive + reset our 5s timeout
      updateStatus(true);
      clearTimeout(disconnectTimer);
      disconnectTimer = setTimeout(() => updateStatus(false), DISCONNECT_TIMEOUT);
      //console.log('[Client] calling processDMXUpdate for universe', data.universe, 'with', data.fixtures.length, 'fixtures');
      processDMXUpdate(data);
      }
  };

  ws.onclose = () => {
    console.log('[Client] WebSocket closed');
    updateStatus(false);
  };
  ws.onerror = (err) => {
    console.error('[Client] WebSocket error', err);
    updateStatus(false);
  };
}


function fetchFixtureTypes() {
  fetch('/fixtures')
    .then(res => res.json())
    .then(types => {
      const select = document.getElementById('fixture-type-select');
      select.innerHTML = '';

      types.forEach(type => {
        // populate dropdown
        const opt = document.createElement('option');
        opt.value = type;
        opt.text  = type;
        select.appendChild(opt);

        // fetch and cache its config
        fetch(`/fixtures/${type}/config.json`)
          .then(r => r.json())
          .then(cfg => {
            fixtureConfigs[type] = cfg;
          })
          .catch(err => console.error(`Failed to load config for ${type}:`, err));
      });
    })
    .catch(err => console.error('[Client] Failed to fetch fixture types:', err));
}

function loadPatch() {
  fetch('/patch/patch.json')
    .then(res => res.json())
    .then(data => {
      // Ensure every entry has x,y (default to 0,0)
      patch = data.map(p => ({
        ...p,
        x: typeof p.x === 'number' ? p.x : 0,
        y: typeof p.y === 'number' ? p.y : 0
      }));
      renderPatchTable();
      rerenderFixtures();
      
      // Optionally persist defaults back
      // savePatch();
    })
    .catch(err => console.error('[Client] Failed to load patch:', err));
}

function addFixture() {
  const type = document.getElementById('fixture-type-select').value;
  const uni  = parseInt(document.getElementById('fixture-universe-input').value, 10);
  const addr = parseInt(document.getElementById('fixture-address-input').value, 10);
  if (!type || isNaN(uni) || isNaN(addr)) {
    return alert('Type, universe & address required');
  }

  // DMX overlap check
  if (conflictsWithExisting({
    universe: uni,
    address: addr,
    footprint: getFootprint(type)
  })) {
    return alert('DMX address conflict in universe ' + uni);
  }

  // ── Compute default X/Y based on last fixture
  // Read your grid-spacing inputs (fallback to 50px if not yet implemented)
  const gridW = parseInt(document.getElementById('grid-width')?.value, 10) || 50;
  const gridH = parseInt(document.getElementById('grid-height')?.value, 10) || 50;

  let x = 0, y = 0;
  if (patch.length > 0) {
    const last = patch[patch.length - 1];
    x = (last.x || 0) + gridW;  // place to the right
    y =  last.y || 0;           // same vertical level
  }

  // Add the fixture with its X/Y
  patch.push({
    fixtureType: type,
    universe:     uni,
    address:      addr,
    x, y
  });

  savePatch();       // persist to server + disk
  renderPatchTable();
  rerenderFixtures();
}

function renderPatchTable() {
  const tbody = document.getElementById('patch-list-body');
  tbody.innerHTML = '';

  patch.forEach((f, i) => {
    const tr = document.createElement('tr');

    // Type | Universe | Address
    ['fixtureType','universe','address'].forEach(key => {
      const td = document.createElement('td');
      td.textContent = f[key];
      td.classList.add(`editable-${key}`);
      td.dataset.index = i;
      tr.appendChild(td);
    });

    // ───── Action column ───────────────────────────────────────
    const tdAct = document.createElement('td');

    // Delete button (already present)
    const btnDel = document.createElement('button');
    btnDel.textContent = '🗑️';
    btnDel.title = 'Remove fixture';
    btnDel.addEventListener('click', () => {
      patch.splice(i, 1);
      savePatch();
      renderPatchTable();
      rerenderFixtures();
    });
    tdAct.appendChild(btnDel);

    // ✏️ Edit button
    const btnEdit = document.createElement('button');
    btnEdit.textContent = '✏️';
    btnEdit.title       = 'Edit universe → address';
    btnEdit.addEventListener('click', () => {
      // enter pencil mode on this row
      pencilMode = true;
      pencilIdx  = i;
      // start by editing the universe cell
      const uniTd = document.querySelector(
        `#patch-list-body td.editable-universe[data-index="${i}"]`
      );
      if (uniTd) uniTd.click();
      else console.warn('No universe cell for row', i);
    });
    tdAct.appendChild(btnEdit);

    tr.appendChild(tdAct);
    tbody.appendChild(tr);
  });
}

document.getElementById('patch-list-body').addEventListener('click', e => {
  const td = e.target.closest('td');
  if (!td) return;

  const isUni  = td.classList.contains('editable-universe');
  const isAdr = td.classList.contains('editable-address');
  if (!isUni && !isAdr) return;

  const idx   = Number(td.dataset.index);
  const field = isUni ? 'universe' : 'address';
  const cur   = patch[idx][field];

  // swap in the input
  td.innerHTML = `
    <input
      type="number" min="1"
      value="${cur}"
      data-field="${field}"
      data-index="${idx}"
    >
  `.trim();

  const inp = td.querySelector('input');
  inp.focus();
  // move caret to end
  if (typeof inp.setSelectionRange === 'function') {
    setTimeout(() => {
      const len = inp.value.length;
      inp.setSelectionRange(len, len);
    }, 0);
  }

  const commit = () => {
    const val = parseInt(inp.value, 10);
    if (isNaN(val) || val < 1) {
      // invalid → revert
      renderPatchTable();
      rerenderFixtures();
      return;
    }

    // ── Always run conflict check on address edits
    if (field === 'address') {
      const footprint = getFootprint(patch[idx].fixtureType);
      const uni       = patch[idx].universe;
      if (conflictsWithExisting({ universe: uni, address: val, footprint }, idx)) {
        alert('Address conflict');
        renderPatchTable();
        rerenderFixtures();
        return;
      }
    }

    // ── Pencil‐mode Universe step
    if (field === 'universe' && pencilMode && idx === pencilIdx) {
      patch[idx][field] = val;
      savePatch();
      renderPatchTable();
      rerenderFixtures();

      // now open Address of same row
      setTimeout(() => {
        const addrTd = document.querySelector(
          `#patch-list-body td.editable-address[data-index="${idx}"]`
        );
        if (addrTd) addrTd.click();
      }, 0);
      return;
    }

    // ── Pencil‐mode Address step (after conflict check above)
    if (field === 'address' && pencilMode && idx === pencilIdx) {
      patch[idx][field] = val;
      savePatch();
      renderPatchTable();
      rerenderFixtures();

      // exit pencil mode
      pencilMode = false;
      pencilIdx  = null;
      return;
    }

    // ── Direct‐click (or final) edit: just save
    patch[idx][field] = val;
    savePatch();
    renderPatchTable();
    rerenderFixtures();
  };

  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') inp.blur();
  });
});

function reloadTable() {
  renderPatchTable();
}

function removeFixture(index) {
  patch.splice(index, 1);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'save', patch }));
  }
  renderPatchTable();
  rerenderFixtures();
}

function rerenderFixtures() {
  const container = document.getElementById('fixture-container');
  container.innerHTML = '';
  // Make sure the container is the positioning context
  container.style.position = 'relative';

  patch.forEach(({ fixtureType, universe, address, x, y }) => {
    loadFixture(fixtureType, address, universe, x, y);
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

/**
 * type: string
 * address: number
 * universe: number
 */
function loadFixture(type, address, universe, x = 0, y = 0) {
  Promise.all([
    fetch(`/fixtures/${type}/template.html`).then(r => r.text()),
    fetch(`/fixtures/${type}/style.css`).then(r => r.text()),
    fetch(`/fixtures/${type}/config.json`).then(r => r.json())
  ])
  .then(([html, css, config]) => {
    const container = document.getElementById('fixture-container');
    const wrapper   = document.createElement('div');
    // include universe in the element ID
    wrapper.id = `fixture-${universe}-${address}`;
    wrapper.dataset.address     = address;
    wrapper.dataset.universe    = universe;
    wrapper.dataset.fixtureType = type;
    wrapper.dataset.config      = JSON.stringify(config);
    // Position absolutely at x,y
    wrapper.style.position = 'absolute';
    wrapper.style.left     = `${x}px`;
    wrapper.style.top      = `${y}px`;
    wrapper.innerHTML = html;
    container.appendChild(wrapper);

    const styleTag = document.createElement('style');
    styleTag.innerHTML = css;
    document.head.appendChild(styleTag);
  })
  .catch(err => console.error(`[Client] Failed loading fixture ${type}:`, err));
}


function processDMXUpdate({ universe, fixtures }) {
    //console.log('[Client] processDMXUpdate() start → universe:', universe, ', fixtures:', fixtures);
  
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
  //console.log('[Client] processDMXUpdate() done');
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

  function getFootprint(type) {
    // read the config.json footprint for this type
    const cfg = fixtureConfigs[type];
    return cfg ? cfg.footprint : 0;
  }
  
function conflictsWithExisting({ universe, address, footprint }, ignoreIndex) {
  return patch.some((f, idx) => {
    if (idx === ignoreIndex) return false;       // <<< don’t conflict with yourself
    if (f.universe !== universe) return false;   
    // overlap test:
    return (address <= f.address + footprint - 1) &&
           (f.address <= address + footprint - 1);
  });
}
  
  function savePatch() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type:'save', patch }));
    }
  }