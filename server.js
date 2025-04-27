const express   = require('express');
const fs        = require('fs');
const os        = require('os');
const path      = require('path');
const http      = require('http');
const WebSocket = require('ws');
const dgram     = require('dgram');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

const PORT      = 3000;
const SACN_PORT = 5568;

let outputFixtures = [];
let universe       = 1;
let nic            = '127.0.0.1';
let udpSocket;

/** Serve static files */
app.use(express.static('public'));
app.use('/fixtures', express.static(path.join(__dirname, 'fixtures')));
app.use(express.static(__dirname));

/** List available NICs */
app.get('/nics', (req, res) => {
  const interfaces = os.networkInterfaces();
  const nics = [{ name: 'TEST SIGNAL', address: '127.0.0.1' }];
  for (const [name, list] of Object.entries(interfaces)) {
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal) {
        nics.push({ name, address: iface.address });
      }
    }
  }
  res.json(nics);
});

/** List fixture types */
app.get('/fixtures', (req, res) => {
  const fixturesPath = path.join(__dirname, 'fixtures');
  fs.readdir(fixturesPath, (err, files) => {
    if (err) return res.json([]);
    const types = files.filter(f =>
      fs.statSync(path.join(fixturesPath, f)).isDirectory()
    );
    res.json(types);
  });
});

/** WebSocket handshake & commands */
wss.on('connection', ws => {
  ws.on('message', raw => {
    const msg = JSON.parse(raw);
    if (msg.type === 'connect') {
      nic = msg.nic;
      universe = parseInt(msg.universe, 10);
      setupReceiver();
      ws.send(JSON.stringify({ type: 'status', connected: true }));
    } else if (msg.type === 'save') {
      fs.writeFileSync('patch.json', JSON.stringify(msg.patch, null, 2));
    }
  });
});

/** Open the sACN receiver on the chosen NIC/universe */
function setupReceiver() {
  if (udpSocket) udpSocket.close();
  udpSocket = dgram.createSocket('udp4');
  udpSocket.bind(SACN_PORT, () => {
    udpSocket.setBroadcast(true);
    udpSocket.setMulticastTTL(128);
    udpSocket.addMembership(
      `239.255.${(universe >> 8) & 0xff}.${universe & 0xff}`,
      nic
    );
  });
  udpSocket.on('message', packet => {
    const data = parseSacn(packet);
    if (!data) return;
    wss.clients.forEach(c => {
      if (c.readyState === WebSocket.OPEN) {
        c.send(JSON.stringify({ type: 'update', fixtures: data }));
      }
    });
  });
}

/** Stub parser—replace with real sACN decoding later */
function parseSacn(packet) {
  return outputFixtures.map(({ address }) => ({
    id: `fixture-${address}`,
    dmx: new Array(512).fill(0)
  }));
}

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
