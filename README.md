# L2V-Visualizer

A web-based lighting visualizer for festival-grade DMX rigs. Mirror real sACN DMX inputs in the browser, patch fixtures live, and preview your show virtually.

---

## Features
- Live sACN input over UDP (port 5568) with real DMX parsing into 512-channel arrays
- Per‑fixture NIC & Universe: select network interface globally; assign universe per fixture in the patch
- Patch management:
  - Add/remove fixtures on the fly
  - Inline edit of address & universe in the patch table
  - Overlap detection to prevent DMX channel conflicts
  - Persist patch data in `patch/patch.json`, with automatic migration of legacy entries
- Modular fixtures:
  - Each fixture in its own folder under `/fixtures`
  - HTML template, CSS, and `config.json` declare footprint, channels, and target elements
- Real-time rendering:
  - Per-fixture DMX offset (`base + attr.channel - 1`)
  - RGB color mapping via `background-color`
  - Frost/glow effect as CSS `filter: blur(...)` when value > 0
- Clean UI: no legacy box-shadow glow; performance throttling and dynamic connect status indicator

---

## Quick Start

1. Clone the repo:

        git clone https://github.com/SynergieOfficial/L2V-Visualizer.git
        cd L2V-Visualizer

2. Install dependencies:

        npm install

3. Run the server:

        node server.js

4. Open `http://localhost:3000` in your browser.
5. Click ⚙️ Settings, select your NIC, then Apply.
6. Add fixtures with their own universe & start addresses, save the patch, and watch them light up!

---

## Project Structure

```
├── fixtures/            # Fixture definitions (template.html, style.css, config.json)
├── patch/
│   └── patch.json       # Current patch data (auto-migrated & saved)
├── public/
│   ├── index.html       # Main UI
│   ├── script.js        # Client logic (WebSocket, DOM, DMX processing)
│   └── style.css        # Global styles
├── server.js            # Express + WebSocket + multi-universe sACN receiver
├── package.json
└── README.md
```

---

## Architecture Overview

1. sACN Input via UDP socket(s) (one per universe)
2. Node.js Server (Express + `dgram` + WebSocket):
   - Serves static files and fixtures
   - `/nics` endpoint enumerates local IPv4 interfaces
   - Manages patch load/save with `patch/patch.json` (auto-migrates legacy entries)
   - Listens on each patched universe’s multicast address and broadcasts `{type:'update', universe, fixtures}`
3. WebSocket Client (browser):
   - Connects to selected NIC
   - Receives real-time DMX updates per-universe
   - Applies `processDMXUpdate()` to update fixture DOM elements
   - Robust status indicator driven by real updates or timeouts
4. DOM Rendering:
   - Fixtures loaded dynamically from `/fixtures/{type}`
   - Config-driven attributes: RGB, intensity, frost (blur)

---

## Changelog

**v0.5.14 (Stable) – 2025-04-28**
- **Patch 1**: Unified inline/pencil editing handler with overlap enforcement for both modes.
- **Patch 2**: Improved caret positioning – cursor now placed at end of value on edit.

**v0.5.13 (Stable) – 2025-04-28**
- **Patch 9**: Added detailed client/server debug logging for WebSocket and UDP events
- **Patch 10**: Enhanced debug with JSON parsing safety (`try/catch`) and improved UDP packet logs
- **Patch 11**: Fixed `ws.on('message')` scoping by wrapping inside `wss.on('connection')`
- **Patch 12**: Removed client-side ping/pong heartbeat; status now driven solely by incoming messages and 5 s timeout
- **Patch 13**: Commented out verbose debug logs to tidy up console output for production

---

## Progress to Date
- **v0.1** – Initial prototype: basic UDP listener and static fixture rendering.
- **v0.2** – Dynamic fixture loading and web UI for patch management.
- **v0.3** – Real-time DMX updates over WebSocket; `processDMXUpdate` implemented.
- **v0.4** – Multi-universe support; UI settings modal for NIC selection.
- **v0.5** – Inline editing, overlap detection, debug logging, and performance improvements.

## Known Issues
- Global Universe input still present in UI—should be removed to avoid confusion
- Legacy patch entries in `patch/patch.json` may not auto-migrate if file permissions prevent overwriting; manual migration might be required
- Performance: rendering many fixtures (>50) can degrade framerate; throttling and virtualization planned for future releases

---

## Roadmap (v0.6+)

- Spatial layout: assign X/Y positions and group fixtures on a virtual grid
- Art‑Net support: ingest and parse Art‑Net alongside sACN
- Advanced frost: directional blur or beam-specific glow per `config.json`

---

## License

MIT © SynergieOfficial

