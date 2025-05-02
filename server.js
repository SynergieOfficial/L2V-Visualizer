const express   = require('express');
const fs        = require('fs');
const os        = require('os');
const path      = require('path');
const http      = require('http');
const WebSocket = require('ws');
const dgram     = require('dgram');
const express = require('express');
const http    = require('http');

const BaseReceiver    = require('./lib/dmx-protocol/baseReceiver');
const { SACNReceiver }   = require('./lib/dmx-protocol/sacnReceiver');
const { ArtNetReceiver } = require('./lib/dmx-protocol/artnetReceiver');

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
let protocol       = 'sACN';      // ← new: "sACN" or "ArtNet"
const sockets      = {};          // reuse your existing sockets map

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
    //console.log('[sACN] WS message received → type:', msg.type, ', payload:', msg);

    if (msg.type === 'connect') {
      nic      = msg.nic;
      protocol = msg.protocol || protocol;    // read protocol from client (fallback to previous)
      console.log(`[sACN] Client connected → NIC=${nic}, protocol=${protocol}`);
    
      loadPatch();      // populates outputFixtures
      setupReceivers(); // will now choose sACN or Art-Net based on `protocol`
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
    //console.log(
    //  `[sACN] Loaded ${outputFixtures.length} fixtures from patch/patch.json`
    //);

  } catch (err) {
    console.log(
      '[sACN] No valid patch/patch.json found or parse error; starting with zero fixtures'
    );
    outputFixtures = [];
  }
}

/** Start listening for sACN packets */
function setupReceivers() {
  // 1) tear down any old sockets
  Object.values(sockets).forEach(s => s.close());
  Object.keys(sockets).forEach(k => delete sockets[k]);

  // 2) dispatch based on protocol
  if (protocol === 'ArtNet') {
    const ARTNET_PORT = 6454;
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    sock.on('error', err => {
      console.error('[Art-Net] UDP socket error:', err);
    });

    sock.bind({ port: ARTNET_PORT, exclusive: false }, () => {
      console.log(`[Art-Net] Listening on ${ARTNET_PORT} via NIC ${nic}`);
    });

    sock.on('message', packet => {
      // check “Art-” header & OpDmx opcode
      if (packet.readUInt16BE(0) !== 0x4174) return;
      if (packet.readUInt16LE(8) !== 0x5000) return;

      const universe = packet.readUInt16LE(14);
      const length   = packet.readUInt16BE(16);
      if (packet.length < 18 + length) return;

      const dmx = Array.from(packet.slice(18, 18 + length));
      const fixtures = outputFixtures
        .filter(f => f.universe === universe)
        .map(f => ({ id:`fixture-${f.universe}-${f.address}`, dmx }));

      const payload = JSON.stringify({ type:'update', universe, fixtures });
      wss.clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN) c.send(payload);
      });
    });

    sockets.artnet = sock;

  } else {
    // old sACN behavior
    const universes = [...new Set(outputFixtures.map(f => f.universe))];
    console.log('[sACN] setupReceivers → monitoring universes:', universes);

    universes.forEach(u => {
      const sock = dgram.createSocket({ type:'udp4', reuseAddr:true });

      sock.on('error', err => {
        console.error(`[sACN] UDP socket error on U${u}:`, err);
      });

      sock.bind({ port: SACN_PORT, exclusive: false }, () => {
        const mcast = `239.255.${(u >> 8)&0xff}.${u&0xff}`;
        sock.addMembership(mcast, nic);
        console.log(`[sACN] Joined U${u} → ${mcast} on NIC ${nic}`);
      });

      sock.on('message', packet => {
        if (packet.length < 512) return;
        const dmx = parseSacn(packet);
        const fixtures = outputFixtures
          .filter(f => f.universe === u)
          .map(f => ({ id:`fixture-${f.universe}-${f.address}`, dmx }));

        const payload = JSON.stringify({ type:'update', universe:u, fixtures });
        wss.clients.forEach(c => {
          if (c.readyState === WebSocket.OPEN) c.send(payload);
        });
      });

      sockets[u] = sock;
    });
  }
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