const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });
const fs = require('fs');
const path = require('path');
//const sACNReceiver = require('sacn-js'); // Assuming you're using sacn-js or similar

let config = {
  nic: '',
  universe: 1
};

// Load fixtures and patch
const patchFilePath = path.join(__dirname, 'patch', 'patch.json');
const patch = JSON.parse(fs.readFileSync(patchFilePath, 'utf-8'));

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

// API Routes
app.get('/nics', (req, res) => {
  // TODO: You might already have NIC discovery, otherwise mock it
  res.json([{ name: 'Default NIC', address: '127.0.0.1' }]);
});

app.get('/config', (req, res) => {
  res.json(config);
});

app.post('/config', (req, res) => {
  config = req.body;
  console.log('Updated config:', config);
  res.sendStatus(200);
  // TODO: Restart or reconfigure sACN receiver
});

// WebSocket handling
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  // Send current patch to the client
  ws.send(JSON.stringify({
    type: 'patch',
    data: patch
  }));

  // Optionally listen to client messages here if needed
});

// Simulate DMX data (replace this with real sACN listener)
setInterval(() => {
  const fakeDMX = new Array(512).fill(0).map(() => Math.floor(Math.random() * 256));

  const fixtureData = patch.map((fixture, index) => {
    const start = fixture.address - 1; // DMX addresses are 1-indexed
    const footprint = fixtureConfigs[fixture.fixtureType]?.footprint || 10; // fallback footprint 10
    const dmxSlice = fakeDMX.slice(start, start + footprint);

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

      // Heartbeat
      client.send(JSON.stringify({
        type: 'dmx_heartbeat'
      }));
    }
  });
}, 100); // Send DMX updates every 100ms
  

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
