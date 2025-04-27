const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });
const dgram = require('dgram');
const os = require('os');
const fs = require('fs');
const path = require('path');

let config = {
  nic: '127.0.0.1',
  universe: 1
};

let udpSocket;

const patchFilePath = path.join(__dirname, 'patch', 'patch.json');
const patch = JSON.parse(fs.readFileSync(patchFilePath, 'utf-8'));

// Load all fixture configs
const fixtureConfigs = {};
const fixturesFolder = path.join(__dirname, 'fixtures');
for (const fixtureType of fs.readdirSync(fixturesFolder)) {
  const configPath = path.join(fixturesFolder, fixtureType, 'config.json');
  if (fs.existsSync(configPath)) {
    fixtureConfigs[fixtureType] = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
}

app.use(express.static('public'));
app.use('/fixtures', express.static('fixtures'));
app.use(express.json());

// NIC listing
app.get('/nics', (req, res) => {
  const interfaces = os.networkInterfaces();
  const nics = [{ name: 'TEST SIGNAL', address: '127.0.0.1' }];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        nics.push({
          name: name,
          address: iface.address
        });
      }
    }
  }

  res.json(nics);
});

// Config handling
app.get('/config', (req, res) => {
  res.json(config);
});

app.post('/config', (req, res) => {
  config = req.body;
  console.log('Updated config:', config);
  setupReceiver();
  res.sendStatus(200);
});

// WebSocket handling
wss.on('connection', (ws) => {
  console.log('New WebSocket client connected.');
  ws.send(JSON.stringify({
    type: 'patch',
    data: patch
  }));
});

// UDP Socket setup
function setupReceiver() {
  if (udpSocket) {
    udpSocket.close();
    console.log('Closed previous UDP socket.');
  }

  udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  udpSocket.on('listening', () => {
    const address = udpSocket.address();
    console.log(`UDP Socket listening on ${address.address}:${address.port}`);
  
    const multicastAddress = universeToMulticastAddress(config.universe);
  
    try {
      udpSocket.addMembership(multicastAddress, config.nic);
      console.log(`Joined multicast group ${multicastAddress} on NIC ${config.nic}`);
    } catch (err) {
      console.error('Failed to join multicast group:', err);
    }
  });

  udpSocket.on('message', (msg) => {
    // Calculate DMX buffer
    const dmxData = msg.slice(126); // Skip sACN headers, get DMX payload
    if (!dmxData || dmxData.length === 0) return;
  
    // Prepare the fixture updates
    const fixturesToSend = patch.map(fixture => {
      const config = fixtureConfigs[fixture.fixtureType];
      if (!config) return null;
  
      const start = fixture.address - 1; // DMX address is 1-indexed
      const end = start + config.footprint;
  
      const fixtureDMX = [];
      for (let i = start; i < end; i++) {
        fixtureDMX.push(dmxData[i] || 0);
      }
  
      return {
        id: fixture.id || `fixture-${fixture.address}`,
        fixtureType: fixture.fixtureType,
        address: fixture.address,   // 🔥 Add address field here
        dmx: fixtureDMX
      };
    }).filter(f => f !== null);
  
    // Broadcast to all WebSocket clients
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'update',
          fixtures: fixturesToSend
        }));
      }
    });
  
    // Also send heartbeat to frontend
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'dmx_heartbeat'
        }));
      }
    });
  });

  udpSocket.on('error', (err) => {
    console.error('UDP Socket error:', err);
  });

  udpSocket.bind(5568, '0.0.0.0');
}

// sACN Multicast Address for given universe
function universeToMulticastAddress(universe) {
  const high = ((universe >> 8) & 0xff);
  const low = (universe & 0xff);
  return `239.255.${high}.${low}`;
}

// Start server
setupReceiver();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
