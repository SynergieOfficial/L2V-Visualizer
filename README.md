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

Based on v0.6 testing, here are the outstanding issues:

1. **Migration Save Timing:** default `x,y` coordinates are only saved *after* WebSocket opens; if WS setup fails, `patch.json` may not be updated.
2. **Control ID Mismatch:** grid-width/height inputs must match the JS IDs (`grid-width-input`/`grid-height-input`) or their listeners won’t fire, preventing the grid from redrawing or snapping to updated values.
3. **Grid Visibility Toggle:** `updateGridVisibility()` must be invoked immediately after `drawGrid()` and tied to the correct checkbox ID, or the overlay will never appear.
4. **Drag-and-Snap Defaults:** until grid-spacing controls work, fixtures only snap using fallback defaults (50px); users may see unexpected positioning if they change the inputs but listeners fail.
5. **Fixture Visibility in Edit Mode:** on dark backgrounds fixtures can be hard to see; the dashed outline depends on the `data-layout-edit` attribute being toggled correctly.
6. **Click Handler Errors:** accidental placeholder `addEventListener` calls with missing arguments will throw type errors and prevent subsequent code from executing.

Please refer to the v0.6 branch commits for the fixes in flight; these Known Issues will be cleared out in v0.6.1 after address ID mismatch and timing fixes are merged.

---
- Global Universe input still present in UI—should be removed to avoid confusion
- Legacy patch entries in `patch/patch.json` may not auto-migrate if file permissions prevent overwriting; manual migration might be required
- Performance: rendering many fixtures (>50) can degrade framerate; throttling and virtualization planned for future releases

---

## Roadmap

- **v0.6 – Layouting**: Introduce an interactive, snapping grid system:
  - Edit Mode toggle in Settings to show/hide the grid overlay
  - Click-and-drag fixtures to X/Y grid positions with snap-to-grid behavior
  - Controls in Settings for horizontal and vertical grid spacing (grid cell width/height)
  - Persist fixture positions in patch data

- **v0.7 – Extensions**:
  - Art‑Net support: ingest and parse Art‑Net alongside sACN
  - Advanced frost: directional blur or beam-specific glow per `config.json`
  - Performance improvements and miscellaneous UX tweaks

---

## License

MIT © SynergieOfficial

