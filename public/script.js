let ws;
let patch = []; // each item: { fixtureType, address, universe }
let fixtureTypes = [];
let sacnConnected = false;

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
      patch = data;
      renderPatchTable();
      rerenderFixtures();
    })
    .catch(err => console.error('[Client] Failed to load patch:', err));
}

function addFixture() {
  const type    = document.getElementById('fixture-type-select').value;
  const uni     = parseInt(document.getElementById('fixture-universe-input').value, 10);
  const addr    = parseInt(document.getElementById('fixture-address-input').value, 10);
  if (!type || isNaN(uni) || isNaN(addr)) return alert('Type, universe & address required');

  // overlap check
  if (conflictsWithExisting({ universe:uni, address:addr, footprint:getFootprint(type) })) {
    return alert('DMX address conflict in universe '+uni);
  }

  patch.push({ fixtureType:type, universe:uni, address:addr });
  savePatch();        // tells server and writes to disk
  renderPatchTable();
  rerenderFixtures();
}

function renderPatchTable() {
  const tbody = document.getElementById('patch-list-body');
  tbody.innerHTML = '';

  patch.forEach((f, i) => {
    const tr = document.createElement('tr');

    // Type
    ['fixtureType','universe','address'].forEach(key => {
      const td = document.createElement('td');
      td.textContent = f[key];
      td.classList.add(`editable-${key}`);
      td.dataset.index = i;
      tr.appendChild(td);
    });

    // Action
    const tdAct = document.createElement('td');
    const btnDel = document.createElement('button');
    btnDel.textContent = '🗑';
    btnDel.title       = 'Remove fixture';
    btnDel.dataset.idx = i;
    btnDel.addEventListener('click', () => {
      patch.splice(i,1);
      savePatch();
      renderPatchTable();
      rerenderFixtures();
    });
    tdAct.appendChild(btnDel);

    const btnEdit = document.createElement('button');
    btnEdit.textContent = '✏️';
    btnEdit.title       = 'Edit address/universe';
    btnEdit.dataset.idx = i;
    tdAct.appendChild(btnEdit);

    tr.appendChild(tdAct);
    tbody.appendChild(tr);
  });
}

document.getElementById('patch-list-body').addEventListener('click', e => {
  const td = e.target.closest('td');
  if (!td) return;

  // only universe or address cells are editable
  const isUni = td.classList.contains('editable-universe');
  const isAddr = td.classList.contains('editable-address');
  if (!isUni && !isAddr) return;

  const idx   = parseInt(td.dataset.index, 10);
  const field = isUni ? 'universe' : 'address';
  const cur   = patch[idx][field];

  // swap in an <input>
  td.innerHTML = `<input
    type="number" min="1"
    value="${cur}"
    data-field="${field}"
    data-index="${idx}"
  >`;

  const inp = td.querySelector('input');
  inp.focus();

  // commit & validate
  const commit = () => {
    const val = parseInt(inp.value, 10);
    if (isNaN(val) || val < 1) {
      renderPatchTable();
      rerenderFixtures();
      return;
    }

    if (field === 'address' && conflictsWithExisting({
      universe: patch[idx].universe,
      address: val,
      footprint: getFootprint(patch[idx].fixtureType)
    })) {
      alert('Address conflict');
      renderPatchTable();
      rerenderFixtures();
      return;
    }

    patch[idx][field] = val;
    savePatch();
    renderPatchTable();
    rerenderFixtures();

    // if it was an address edit, jump to the next row
    if (field === 'address' && idx + 1 < patch.length) {
      setTimeout(() => {
        const nextTd = document.querySelector(
          `#patch-list-body td.editable-address[data-index="${idx+1}"]`
        );
        if (nextTd) nextTd.click();
      }, 0);
    }
  };

  // commit on blur or Enter
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

  patch.forEach(({ fixtureType, universe, address }) => {
    loadFixture(fixtureType, address, universe);
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
function loadFixture(type, address, universe) {
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
  console.log('[Client] processDMXUpdate() done');
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

document.getElementById('patch-list-body').addEventListener('click', e => {
  const td = e.target.closest('td');
  if (!td) return;

  // only universe or address cells are editable
  const isUni = td.classList.contains('editable-universe');
  const isAddr = td.classList.contains('editable-address');
  if (!isUni && !isAddr) return;

  const idx   = parseInt(td.dataset.index, 10);
  const field = isUni ? 'universe' : 'address';
  const cur   = patch[idx][field];

  // swap in an <input>
  td.innerHTML = `<input
    type="number" min="1"
    value="${cur}"
    data-field="${field}"
    data-index="${idx}"
  >`;

  const inp = td.querySelector('input');
  inp.focus();

  // commit & validate
  const commit = () => {
    const val = parseInt(inp.value, 10);
    if (isNaN(val) || val < 1) {
      renderPatchTable();
      rerenderFixtures();
      return;
    }

    if (field === 'address' && conflictsWithExisting({
      universe: patch[idx].universe,
      address: val,
      footprint: getFootprint(patch[idx].fixtureType)
    })) {
      alert('Address conflict');
      renderPatchTable();
      rerenderFixtures();
      return;
    }

    patch[idx][field] = val;
    savePatch();
    renderPatchTable();
    rerenderFixtures();

    // if it was an address edit, jump to the next row
    if (field === 'address' && idx + 1 < patch.length) {
      setTimeout(() => {
        const nextTd = document.querySelector(
          `#patch-list-body td.editable-address[data-index="${idx+1}"]`
        );
        if (nextTd) nextTd.click();
      }, 0);
    }
  };

  // commit on blur or Enter
  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') inp.blur();
  });
});

  function getFootprint(type) {
    // read the config.json footprint for this type
    const cfg = fixtureConfigs[type];
    return cfg ? cfg.footprint : 0;
  }
  
  function conflictsWithExisting({ universe, address, footprint }) {
    return patch.some(f => {
      if (f.universe !== universe) return false;
      // overlap if ranges [address, address+footprint-1] intersect
      return (address <= f.address + footprint - 1) &&
             (f.address <= address + footprint - 1);
    });
  }
  
  function savePatch() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type:'save', patch }));
    }
  }