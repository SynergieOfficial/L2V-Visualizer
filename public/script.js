let socket;
let patch = [];
let availableFixtures = [];
let universe = 1;
let selectedNIC = '127.0.0.1';
let receiverInitialized = false;

function connectWebSocket() {
  socket = new WebSocket('ws://' + window.location.host);

  socket.addEventListener('open', () => {
    console.log('[Client] WebSocket connected');
    document.getElementById('sacn-status').textContent = 'Status: 🟢 Connected';
  });

  socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'patch') {
      patch = data.patch;
      renderPatchTable();
      loadFixturesFromPatch();
    }

    if (data.type === 'update') {
      applyDmxToFixtures(data.fixtures);
    }
  });

  socket.addEventListener('close', () => {
    console.log('[Client] WebSocket closed, retrying...');
    document.getElementById('sacn-status').textContent = 'Status: 🔴 Disconnected';
    setTimeout(connectWebSocket, 1000);
  });
}

function applySettings() {
  selectedNIC = document.getElementById('nic').value;
  universe = parseInt(document.getElementById('universe').value);

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'settings', nic: selectedNIC, universe: universe }));
    console.log('[Client] Sent settings to server:', { nic: selectedNIC, universe: universe });
  }
}

function renderPatchTable() {
  const tbody = document.getElementById('patch-list-body');
  tbody.innerHTML = '';

  patch.forEach(fixture => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${fixture.fixtureType}</td><td>${fixture.address}</td>`;
    tbody.appendChild(row);
  });
}

async function loadFixturesFromPatch() {
  const container = document.getElementById('fixture-container');
  container.innerHTML = '';

  for (const fixture of patch) {
    await loadFixture(fixture);
  }
}

async function loadFixture(fixture) {
  const container = document.getElementById('fixture-container');

  const fixtureDiv = document.createElement('div');
  fixtureDiv.id = `fixture-${fixture.address}`;
  fixtureDiv.dataset.address = fixture.address;
  fixtureDiv.dataset.fixtureType = fixture.fixtureType;

  try {
    const htmlResponse = await fetch(`/fixtures/${fixture.fixtureType}/template.html`);
    const html = await htmlResponse.text();
    fixtureDiv.innerHTML = html;

    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = `/fixtures/${fixture.fixtureType}/style.css`;
    document.head.appendChild(cssLink);

    container.appendChild(fixtureDiv);
  } catch (err) {
    console.error('[Client] Failed loading fixture HTML/CSS:', err);
  }
}

async function fetchFixtureTypes() {
  const select = document.getElementById('fixture-type-select');
  select.innerHTML = '';

  try {
    const response = await fetch('/fixture-types');
    const types = await response.json();

    availableFixtures = types;
    types.forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      select.appendChild(option);
    });
  } catch (err) {
    console.error('[Client] Failed to load fixture types', err);
  }
}

function addFixture() {
  const type = document.getElementById('fixture-type-select').value;
  const address = parseInt(document.getElementById('fixture-address-input').value);

  if (!type || !address) {
    alert('Select fixture type and address.');
    return;
  }

  patch.push({ fixtureType: type, address });
  renderPatchTable();
  loadFixture({ fixtureType: type, address });
}

function savePatch() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'savePatch', patch }));
    console.log('[Client] Sent patch to server for saving.');
  }
}

function applyDmxToFixtures(fixtures) {
  fixtures.forEach(fixture => {
    const elem = document.getElementById(`fixture-${fixture.address}`);
    if (!elem) return;

    fixture.channels.forEach(channel => {
      if (channel.type === 'rgb') {
        const target = elem.querySelector(`#${fixture.fixtureType}`);
        if (target) {
          target.style.backgroundColor = `rgb(${channel.value[0]},${channel.value[1]},${channel.value[2]})`;
        }
      }

      if (channel.type === 'intensity') {
        const target = elem.querySelector(`#${fixture.fixtureType}`);
        if (target) {
          target.style.opacity = channel.value / 255;
        }
      }

      if (channel.type === 'frost') {
        const target = elem.querySelector(`#${fixture.fixtureType}`);
        if (target) {
          target.style.boxShadow = `0 0 20px 15px rgba(255,255,255,${channel.value/255})`;
        }
      }
    });
  });
}

window.addEventListener('DOMContentLoaded', () => {
  connectWebSocket();
  fetchFixtureTypes();

  document.getElementById('add-fixture-btn').addEventListener('click', addFixture);
  document.getElementById('save-patch-btn').addEventListener('click', savePatch);
  document.getElementById('settings-icon').addEventListener('mouseenter', () => {
    document.getElementById('settings-modal').style.display = 'block';
  });
  document.getElementById('settings-modal').addEventListener('mouseleave', () => {
    setTimeout(() => {
      document.getElementById('settings-modal').style.display = 'none';
    }, 3000);
  });
});
