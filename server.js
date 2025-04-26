const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Receiver } = require('sacn'); // <- IMPORTANT: using 'sacn' package!

let config = {
  nic: '127.0.0.1',
  universe: 1
};

// Load Patch
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

// NIC listing (only TEST SIGNAL for now)
app.get('/nics', (req, res) => {
  const interfaces = os.networkInterfaces();
  const nics = [{ name: 'TEST SIGNAL', address: '127.0.0.1' }]; // Add TEST SIGNAL manually

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        nics.push({
          name: `${name}`,
          address: iface.address
        });
      }
    }
  }

  res.json(nics);
});

// Get current config
app.get('/config', (req, res) => {
  res.json(config);
});

// Update config (Apply button triggers this)
app.post('/config', (req, res) => {
  config = req.body;
  console.log('Updated config:', config);
  setupReceiver(); // Restart sACN receiver
  res.sendStatus(200);
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket client connected.');

  ws.send(JSON.stringify({
    type: 'patch',
    data: patch
  }));
});

// sACN Receiver setup
let receiver;
function setupReceiver() {
  if (receiver) {
    receiver.close();
    console.log('Closed previous sACN receiver.');
  }

  receiver = new Receiver({
    universes: [config.universe],
    iface: config.nic // <- BIND to the selected NIC IP!
  });

  receiver.on('packet', (packet) => {
    const dmx = packet.payload;

    const fixtureData = patch.map((fixture, index) => {
      const start = fixture.address - 1;
      const footprint = fixtureConfigs[fixture.fixtureType]?.footprint || 10;
      const dmxSlice = dmx.slice(start, start + footprint);

      return {
        id: `fixture-${index + 1}`,
        fixtureType: fixture.fixtureType,
        dmx: dmxSlice
      };
    });

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'update',
          fixtures: fixtureData
        }));

        client.send(JSON.stringify({
          type: 'dmx_heartbeat'
        }));
      }
    });
  });

  receiver.on('error', (err) => {
    console.error('sACN Receiver error:', err);
  });

  console.log(`sACN Receiver listening on NIC ${config.nic} Universe ${config.universe}`);
}

// Initial startup
setupReceiver();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
