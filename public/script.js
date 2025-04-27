// script.js (fully integrated, based on latest repo + fixes)

let ws;
let outputFixtures = [];
let fixtureTypes = [];
let receiverSetup = false;

function connectWebSocket() {
  ws = new WebSocket(`ws://${location.host}`);

  ws.onopen = () => {
    console.log("[Client] WebSocket connected");
  };

  ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'patch') {
      console.log("[Client] Received patch:", data.patch);
      outputFixtures = data.patch;
      renderFixtures();
      updatePatchTable();
    }

    if (data.type === 'fixtures') {
      console.log("[Client] Received fixture types:", data.fixtures);
      fixtureTypes = data.fixtures;
      updateFixtureDropdown();
    }

    if (data.type === 'update') {
      console.log("[Client] Received update DMX frame:", data.fixtures);
      applyDMXData(data.fixtures);
    }
  };

  ws.onclose = () => {
    console.log("[Client] WebSocket disconnected, retrying in 1s...");
    setTimeout(connectWebSocket, 1000);
  };
}

function applyDMXData(fixtures) {
  fixtures.forEach(fixture => {
    const element = document.getElementById(`fixture-${fixture.address}`);
    console.log(`[Client] Processing fixture ID: fixture-${fixture.address}`);
    if (!element) return;

    fixture.channels.forEach(attr => {
      console.log(`[Client] Applying ${attr.type} to element fixture-${fixture.address} with channels`, attr.channels);

      if (attr.type === "RGB") {
        const color = `rgb(${attr.channels[0]}, ${attr.channels[1]}, ${attr.channels[2]})`;
        element.querySelector('div').style.backgroundColor = color;
      } else if (attr.type === "Intensity") {
        element.style.opacity = attr.channels[0] / 255;
      } else if (attr.type === "Frost") {
        element.querySelector('div').style.boxShadow = `0 0 20px 15px rgba(255,255,255,${attr.channels[0]/255})`;
      }
    });
  });
}

function renderFixtures() {
  const container = document.getElementById("fixture-container");
  container.innerHTML = '';

  outputFixtures.forEach(async (fixture) => {
    const res = await fetch(`/fixtures/${fixture.fixtureType}/template.html`);
    const html = await res.text();

    const div = document.createElement('div');
    div.innerHTML = html;
    div.id = `fixture-${fixture.address}`;
    div.setAttribute('data-address', fixture.address);
    div.setAttribute('data-fixture-type', fixture.fixtureType);
    container.appendChild(div);

    // Load fixture CSS if not already loaded
    if (!document.querySelector(`link[href="/fixtures/${fixture.fixtureType}/style.css"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `/fixtures/${fixture.fixtureType}/style.css`;
      document.head.appendChild(link);
    }
  });
}

function updatePatchTable() {
  const tableBody = document.getElementById("patch-list-body");
  tableBody.innerHTML = '';
  outputFixtures.forEach(fixture => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${fixture.fixtureType}</td><td>${fixture.address}</td>`;
    tableBody.appendChild(row);
  });
}

function updateFixtureDropdown() {
  const select = document.getElementById("fixture-type-select");
  select.innerHTML = '';
  fixtureTypes.forEach(type => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    select.appendChild(option);
  });
}

async function addFixture() {
  const fixtureType = document.getElementById("fixture-type-select").value;
  const address = parseInt(document.getElementById("fixture-address-input").value);
  if (!fixtureType || !address) return;

  outputFixtures.push({ fixtureType, address });
  ws.send(JSON.stringify({ type: 'patch', patch: outputFixtures }));
  renderFixtures();
  updatePatchTable();
}

async function savePatch() {
  ws.send(JSON.stringify({ type: 'save-patch', patch: outputFixtures }));
}

function applySettings() {
  const nic = document.getElementById("nic").value;
  const universe = document.getElementById("universe").value;
  ws.send(JSON.stringify({ type: 'settings', nic, universe }));
  document.getElementById("sacn-status").textContent = 'Status: 🟢 Connected';
}

function setupEvents() {
  document.getElementById("add-fixture-btn").addEventListener('click', addFixture);
  document.getElementById("save-patch-btn").addEventListener('click', savePatch);
  document.getElementById("settings-icon").addEventListener('click', () => {
    document.getElementById("settings-modal").style.display = 'block';
  });
  document.getElementById("settings-modal").addEventListener('mouseleave', () => {
    setTimeout(() => {
      document.getElementById("settings-modal").style.display = 'none';
    }, 5000);
  });
}

window.onload = () => {
  connectWebSocket();
  setupEvents();
};
