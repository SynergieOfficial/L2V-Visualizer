// server.js

const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const dgram = require('dgram');
const os = require('os');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));
app.use(express.static('public'));
app.use('/fixtures', express.static(path.join(__dirname, 'fixtures')));
app.use(express.json());

let patch = require('./patch/patch.json');
let config = {
  nic: '127.0.0.1',
  universe: 1
};
let udpSocket;
let lastDmxTimestamp = Date.now();

// List NICs
app.get('/nics', (req, res) => {
  const interfaces = os.networkInterfaces();
  const nics = [];
  for (const name in interfaces) {
    for (const nic of interfaces[name]) {
      if (!nic.internal && nic.family === 'IPv4') {
        nics.push({ name, address: nic.address });
      }
    }
  }
  nics.unshift({ name: 'TEST SIGNAL', address: '127.0.0.1' });
  res.json(nics);
});

// Config endpoints
app.get('/config', (req, res) => {
  res.json(config);
});

app.post('/config', (req, res) => {
  const { nic, universe } = req.body;
  config.nic = nic;
  config.universe = parseInt(universe, 10);

  console.log('Updated config:', config);

  if (udpSocket) {
    udpSocket.close();
    console.log('Closed previous UDP socket.');
  }

  setupReceiver(); // Start fresh with new NIC and Universe after Apply
  res.json({ status: 'ok' });
});

// Fixture and patch endpoints
app.get('/fixtures', (req, res) => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const fixtureTypes = fs.readdirSync(fixturesDir).filter(name => {
    const fullPath = path.join(fixturesDir, name);
    return fs.lstatSync(fullPath).isDirectory();
  });
  res.json(fixtureTypes);
});

app.get('/patch/patch.json', (req, res) => {
  res.json(patch);
});

app.post('/patch', (req, res) => {
  patch = req.body;
  console.log('Patch updated:', patch);
  res.json({ status: 'ok' });
});

app.post('/save-patch', (req, res) => {
  fs.writeFileSync(path.join(__dirname, 'patch/patch.json'), JSON.stringify(patch, null, 2));
  res.json({ status: 'ok' });
});

// UDP Receiver Setup
function setupReceiver() {
  udpSocket = dgram.createSocket('udp4');

  udpSocket.on('listening', () => {
    const address = udpSocket.address();
    console.log(`UDP Socket listening on ${address.address}:${address.port}`);
    try {
      const multicastGroup = `239.255.0.${config.universe}`;
      udpSocket.addMembership(multicastGroup, config.nic === '127.0.0.1' ? undefined : config.nic);
      console.log(`Joined multicast group ${multicastGroup} on NIC ${config.nic}`);
    } catch (err) {
      console.error('UDP Socket error:', err);
    }
  });

  udpSocket.on('message', (msg) => {
    if (msg.length < 126) return; // sACN minimum packet size
    const universe = msg.readUInt16BE(113);
    if (universe !== config.universe) return;

    const dmxData = msg.slice(126);
    lastDmxTimestamp = Date.now();

    const fixtureData = patch.map(fixture => {
      const slice = dmxData.slice(fixture.address - 1, fixture.address - 1 + 40);
      return {
        id: fixture.id || `fixture-${fixture.address}`,
        dmx: Array.from(slice)
      };
    });

    const payload = JSON.stringify({ type: 'update', fixtures: fixtureData });

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  });

  udpSocket.bind(5568);
}

wss.on('connection', (ws) => {
  console.log('New WebSocket client connected.');

  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      const now = Date.now();
      if (now - lastDmxTimestamp < 3000) {
        ws.send(JSON.stringify({ type: 'dmx_heartbeat', status: 'connected' }));
      } else {
        ws.send(JSON.stringify({ type: 'dmx_heartbeat', status: 'waiting' }));
      }
    } else {
      clearInterval(interval);
    }
  }, 1000);
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
