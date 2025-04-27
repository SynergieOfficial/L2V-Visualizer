// Preparing the correct server.js and script.js fixes based on your repo

// === server.js (full fixed version) ===
const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const dgram = require('dgram');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 3000;
const SACN_PORT = 5568;

let outputFixtures = [];
let universe = 1;
let nic = '127.0.0.1';

let udpSocket;

app.use(express.static('public'));

// Serve fixtures and patch folder
app.use('/fixtures', express.static(path.join(__dirname, 'fixtures')));
app.use(express.static(__dirname));

// API to get available NICs
app.get('/nics', (req, res) => {
  const interfaces = os.networkInterfaces();
  const nics = [{ name: 'TEST SIGNAL', address: '127.0.0.1' }];
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        nics.push({ name, address: iface.address });
      }
    }
  }
  res.json(nics);
});

// API to get fixture types
app.get('/fixtures', (req, res) => {
  const fixturesPath = path.join(__dirname, 'fixtures');
  fs.readdir(fixturesPath, (err, files) => {
    if (err) {
      res.json([]);
    } else {
      const types = files.filter(file => fs.statSync(path.join(fixturesPath, file)).isDirectory());
      res.json(types);
    }
  });
});

wss.on('connection', (ws) => {
  console.log('New WebSocket client connected.');

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    if (data.type === 'connect') {
      nic = data.nic;
      universe = parseInt(data.universe);
      setupReceiver();
      ws.send(JSON.stringify({ type: 'status', connected: true }));
    } else if (data.type === 'save') {
      fs.writeFileSync('patch.json', JSON.stringify(data.patch, null, 2));
      console.log('Patch saved to disk.');
    }
  });
});

function setupReceiver() {
  if (udpSocket) {
    udpSocket.close();
  }
  udpSocket = dgram.createSocket('udp4');

  udpSocket.bind(SACN_PORT, () => {
    udpSocket.setBroadcast(true);
    udpSocket.setMulticastTTL(128);
    udpSocket.addMembership(`239.255.${(universe >> 8) & 0xff}.${universe & 0xff}`, nic);
    console.log(`UDP Socket listening on ${nic}:${SACN_PORT}`);
  });

  udpSocket.on('message', (msg) => {
    const dmxData = parseSacn(msg);
    if (!dmxData) return;
    
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'update', fixtures: dmxData }));
      }
    });
  });
}

function parseSacn(packet) {
  // Dummy parser for now - customize based on real SACN parsing
  return outputFixtures.map(({ address, fixtureType }) => ({
    id: `fixture-${address}`,
    dmx: new Array(512).fill(0),
  }));
}

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
