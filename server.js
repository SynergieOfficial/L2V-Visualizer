// server.js

const express   = require('express');
const fs        = require('fs');
const os        = require('os');
const path      = require('path');
const http      = require('http');
const WebSocket = require('ws');
const dgram     = require('dgram');

// DMX protocol abstraction:
const BaseReceiver    = require('./lib/dmx-protocol/baseReceiver');
const { SACNReceiver }   = require('./lib/dmx-protocol/sacnReceiver');
const { ArtNetReceiver } = require('./lib/dmx-protocol/artnetReceiver');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

const PORT      = 3000;
const patchFile = path.join(__dirname, 'patch', 'patch.json');

let outputFixtures = [];      // { universe: Number, address: Number }[]
let nic            = '127.0.0.1';
let protocol       = 'sACN';  // "sACN" or "ArtNet"
let receiver       = null;

/** Static file serving */
app.use(express.static('public'));
app.use('/fixtures', express.static(path.join(__dirname, 'fixtures')));
app.use(express.static(__dirname));

/** List available NICs */
app.get('/nics', (req, res) => {
  const interfaces = os.networkInterfaces();
  const nics = [{ name: 'TEST SIGNAL', address: '127.0.0.1' }];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const iface of addrs) {
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
  console.log('[sACN] WebSocket client connected');

  ws.on('message', raw => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (err) {
      console.error('[sACN] Invalid JSON →', raw);
      return;
    }

    if (msg.type === 'connect') {
      //console.log('[DEBUG] outputFixtures:', outputFixtures);
      nic      = msg.nic;
      protocol = msg.protocol || protocol;
      console.log(`[sACN] Client connected → NIC=${nic}, protocol=${protocol}`);

      loadPatch();
      setupReceivers();
      ws.send(JSON.stringify({ type: 'status', connected: true }));

    } else if (msg.type === 'save') {
      fs.writeFileSync(patchFile, JSON.stringify(msg.patch, null, 2), 'utf-8');
      console.log('[sACN] patch/patch.json saved');
      outputFixtures = msg.patch.map(p => ({
        universe: p.universe,
        address: p.address
      }));
      //console.log('[DEBUG] outputFixtures updated:', outputFixtures);

    } else if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));

    } else {
      console.warn('[sACN] Unknown WS message type →', msg.type);
    }
  });
});

/** Load patch into memory */
function loadPatch() {
  try {
    let patchData = JSON.parse(fs.readFileSync(patchFile, 'utf-8'));

    // back‐fill missing universe → 1
    let migrated = false;
    patchData = patchData.map(entry => {
      if (entry.universe === undefined) {
        migrated = true;
        return { ...entry, universe: 1 };
      }
      return entry;
    });

    if (migrated) {
      fs.writeFileSync(patchFile, JSON.stringify(patchData, null, 2), 'utf-8');
      console.log('[sACN] Migrated patch.json to include universe=1');
    }

    outputFixtures = patchData.map(p => ({
      universe: p.universe,
      address:  p.address
    }));
  } catch (err) {
    console.log('[sACN] No patch.json found; starting with empty patch');
    outputFixtures = [];
  }
}

/**
 * Start (or restart) the DMX receiver using the chosen protocol.
 * Tears down the old receiver, spins up a new one, and broadcasts frames.
 */
function setupReceivers() {
  // 1) Tear down old receiver
  if (receiver) {
    receiver.stop();
    receiver = null;
  }

  // 2) Pick class based on protocol
  const ReceiverClass = protocol === 'ArtNet'
    ? ArtNetReceiver
    : SACNReceiver;

  // 3) Instantiate and wire up
  receiver = new ReceiverClass({
    nic,
    universes: [...new Set(outputFixtures.map(f => f.universe))]
  });

  receiver.on('data', ({ universe: rawUniverse, channels }) => {
    // Map Art-Net 0-based → UI 1-based; sACN is already correct
    const universe = protocol === 'ArtNet'
      ? rawUniverse + 1
      : rawUniverse;

    //console.log(
    //  `[DEBUG][${protocol}] rawUniverse=${rawUniverse} → universe=${universe}:`,
    //  channels.slice(0, 8)
    //);

    const fixtures = outputFixtures
      .filter(f => f.universe === universe)
      .map(f => ({
        id:  `fixture-${universe}-${f.address}`,
        dmx: channels
      }));

    const payload = JSON.stringify({ type: 'update', universe, fixtures });
    wss.clients.forEach(c => {
      if (c.readyState === WebSocket.OPEN) {
        c.send(payload);
      }
    });
  });

  // 4) Start listening
  receiver.start();
}

/** Simple sACN parser: take the last 512 bytes */
function parseSacn(packet) {
  if (packet.length < 512) return [];
  return Array.from(packet.slice(packet.length - 512));
}

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('Shutting down DMX receiver…');
  if (receiver) receiver.stop();
  process.exit();
});
