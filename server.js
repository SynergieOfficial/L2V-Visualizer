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
const wss = new WebSocket.Server({ server });

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
// ── when a new browser connects, set up its message handler
wss.on('connection', ws => {
  console.log('[sACN] WebSocket client connected');

  // Handle every incoming WS frame from this client:
  ws.on('message', raw => {
    // ── parse & log every incoming WS frame
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (err) {
      console.error('[sACN] Invalid JSON from WS client →', raw);
      return;
    }
    console.log('[sACN] WS message received → type:', msg.type, ', payload:', msg);

    if (msg.type === 'connect') {
      nic = msg.nic;
      console.log(`[sACN] Client connected → NIC=${nic}`);

      loadPatch();     // populates outputFixtures
      setupReceivers();// spawns one UDP socket per universe
      ws.send(JSON.stringify({ type: 'status', connected: true }));

    } else if (msg.type === 'save') {
      fs.writeFileSync(patchFile, JSON.stringify(msg.patch, null, 2));
      console.log('[sACN] patch/patch.json saved');
      console.log(`[sACN] outputFixtures now has ${msg.patch.length} entries`);
      outputFixtures = msg.patch.map(p => ({
        universe: p.universe,
        address: p.address
      }));

    } else if (msg.type === 'ping') {
      // heartbeat reply
      ws.send(JSON.stringify({ type: 'pong' }));
    } else {
      console.warn('[sACN] WS got unknown msg.type →', msg.type);
    }
  }); // end ws.on('message')
});   // end wss.on('connection')


/** Load patch into memory */
function loadPatch() {
  try {
    // Read existing patch data
    let patchData = JSON.parse(fs.readFileSync(patchFile, 'utf-8'));

    // Back-fill missing universe → 1
    let migrated = false;
    patchData = patchData.map(entry => {
      if (entry.universe === undefined) {
        migrated = true;
        return { ...entry, universe: 1 };
      }
      return entry;
    });

    // If we added universe fields, overwrite on disk
    if (migrated) {
      fs.writeFileSync(patchFile, JSON.stringify(patchData, null, 2), 'utf-8');
      console.log('[sACN] Migrated patch.json entries to include universe=1');
    }

    // Populate in-memory fixtures
    outputFixtures = patchData.map(p => ({
      universe: p.universe,
      address: p.address
    }));
    console.log(
      `[sACN] Loaded ${outputFixtures.length} fixtures from patch/patch.json`
    );

  } catch (err) {
    console.log(
      '[sACN] No valid patch/patch.json found or parse error; starting with zero fixtures'
    );
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
      // ── log every UDP sACN packet
      console.log(`[sACN] UDP packet received on universe ${u} → length ${packet.length}`);
      const dmx = parseSacn(packet);
      console.log(`[sACN] Parsed DMX frame of ${dmx.length} channels for universe ${u}`);
 
      // build per-fixture updates for this universe…
      const fixtures = outputFixtures
        .filter(f => f.universe === u)
        .map(f => ({
          id: `fixture-${f.universe}-${f.address}`,
          dmx
        }));
    
      // broadcast with type:'update'
      const payload = JSON.stringify({
        type: 'update',
        universe: u,
        fixtures
      });
      console.log('[sACN] Broadcasting update →', payload);
    
      wss.clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN) {
          c.send(payload);
        }
      });
    });
    sockets[u] = sock;
  });
}

/** Simple sACN parser: use last 512 bytes */
function parseSacn(packet) {
  if (packet.length < 512) return [];
  const start = packet.length - 512;
  return Array.from(packet.slice(start, start + 512));
}

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});