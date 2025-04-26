
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const dgram = require('dgram');
const os = require('os');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static('public'));
app.use('/fixtures', express.static(path.join(__dirname, 'fixtures')));

let udpSocket;
let currentNIC = null;
let currentUniverse = 1;
const SETTINGS_PATH = path.join(__dirname, 'settings.json');

const fixtures = [
  { id: "fixture1", type: "TestSquare", startAddress: 1 },
  { id: "fixture2", type: "BOLT1C", startAddress: 41 }
];

const fixtureTypes = {};
function loadFixtures() {
  const baseDir = path.join(__dirname, 'fixtures');
  const types = fs.readdirSync(baseDir);
  types.forEach(type => {
    const configPath = path.join(baseDir, type, 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      fixtureTypes[type] = config;
    }
  });
}
loadFixtures();

function getNICList() {
  const interfaces = os.networkInterfaces();
  const nicList = [];
  for (const [name, infos] of Object.entries(interfaces)) {
    for (const info of infos) {
      if (info.family === 'IPv4' && !info.internal) {
        nicList.push({ name, address: info.address });
      }
    }
  }
  return nicList;
}

function universeToMulticast(universe) {
  return `239.255.${(universe >> 8) & 0xff}.${universe & 0xff}`;
}

function startReceiver(nicAddress, universe) {
  if (udpSocket) udpSocket.close();

  currentNIC = nicAddress;
  currentUniverse = universe;

  const multicastAddr = universeToMulticast(universe);
  udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  udpSocket.on('message', (msg) => {
    const dmx = msg.slice(126, 126 + 512);
    const updates = fixtures.map(fixture => {
      const def = fixtureTypes[fixture.type];
      const base = fixture.startAddress - 1;
      return {
        id: fixture.id,
        dmx: Array.from(dmx.slice(base, base + def.channels))
      };
    });

    const heartbeat = JSON.stringify({ type: 'dmx_heartbeat' });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'update', fixtures: updates }));
        client.send(heartbeat);
      }
    });
  });

  udpSocket.bind(5568, nicAddress, () => {
    udpSocket.addMembership(multicastAddr, nicAddress);
    console.log(`Listening on ${multicastAddr} via ${nicAddress}`);
  });
}

// API
app.get('/nics', (req, res) => res.json(getNICList()));
app.get('/config', (req, res) => {
  if (fs.existsSync(SETTINGS_PATH)) {
    res.json(JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')));
  } else {
    res.json({ nic: "", universe: 1 });
  }
});
app.post('/config', (req, res) => {
  const { nic, universe } = req.body;
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify({ nic, universe }, null, 2));
  startReceiver(nic, parseInt(universe));
  res.sendStatus(200);
});

wss.on('connection', () => {
  console.log('WebSocket client connected');
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
