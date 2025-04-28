const express   = require('express');
const fs        = require('fs');
const os        = require('os');
const path      = require('path');
const http      = require('http');
const WebSocket = require('ws');
const dgram     = require('dgram');
const sockets = {}; // universe → dgram socket

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

const PORT      = 3000;
const SACN_PORT = 5568;
// point at patch/patch.json instead of root
const patchFile = path.join(__dirname, 'patch', 'patch.json');

let outputFixtures = [];
let universe       = 1;
let nic            = '127.0.0.1';
let udpSocket;

/** Static file serving */
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

/** WebSocket: connect & save */
wss.on('connection', ws => {
  ws.on('message', raw => {
    const msg = JSON.parse(raw);

    if (msg.type === 'connect') {
      nic = msg.nic;
      universe = parseInt(msg.universe, 10);
      console.log(`[sACN] Client connected → NIC=${nic}, universe=${universe}`);
      loadPatch();        // now gives outputFixtures = [{address, universe},…]
setupReceivers();
      ws.send(JSON.stringify({ type: 'status', connected: true }));

    } else if (msg.type === 'save') {
      fs.writeFileSync(patchFile, JSON.stringify(msg.patch, null, 2));
      console.log('[sACN] patch/patch.json saved');
      outputFixtures = msg.patch.map(p => ({ address: p.address }));
    }
  });
});

/** Load patch into memory */
function loadPatch() {
  try {
    const patch = JSON.parse(fs.readFileSync(patchFile));
    outputFixtures = patch.map(p => ({ address: p.address }));
    console.log(`[sACN] Loaded ${outputFixtures.length} fixtures from patch/patch.json`);
  } catch {
    console.log('[sACN] No valid patch/patch.json found; starting with zero fixtures');
    outputFixtures = [];
  }
}

/** Start listening for sACN packets */
function setupReceivers() {
  // close old sockets
  Object.values(sockets).forEach(s=>s.close());
  Object.keys(sockets).forEach(u=>delete sockets[u]);

  // unique universes in current patch
  const universes = [...new Set(outputFixtures.map(f=>f.universe))];
  universes.forEach(u => {
    const sock = dgram.createSocket('udp4');
    sock.bind(SACN_PORT, () => {
      const mcast = `239.255.${(u>>8)&0xff}.${u&0xff}`;
      sock.addMembership(mcast, nic);
      console.log(`[sACN] Joined universe ${u} → ${mcast}`);
    });
    sock.on('message', packet => {
      const dmx = parseSacn(packet);
      // only send the fixtures in this universe
      const fixtures = outputFixtures
        .filter(f=>f.universe===u)
        .map(f=>({ id:`fixture-${f.universe}-${f.address}`, dmx }));
      wss.clients.forEach(c => {
        if (c.readyState===WebSocket.OPEN) {
          c.send(JSON.stringify({ universe:u, fixtures }));
        }
      });
    });
    sockets[u] = sock;
  });
}

/** Simple sACN parser: use last 512 bytes */
function parseSacn(packet) {
  if (packet.length < 512) return [];
  const sliceStart = packet.length - 512;
  const dmx = Array.from(packet.slice(sliceStart, sliceStart + 512));
  return outputFixtures.map(({ address }) => ({
    id: `fixture-${address}`,
    dmx
  }));
}

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});