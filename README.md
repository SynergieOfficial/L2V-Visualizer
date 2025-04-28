# L2V-Visualizer

A web-based lighting visualizer for festival-grade DMX rigs. Mirror real sACN DMX inputs in the browser, patch fixtures live, and preview your show virtually.

---

## 🔹 Features

- **Live sACN input** over UDP (port 5568) with real DMX parsing into 512-channel arrays
- **Per‑fixture NIC & Universe**: select network interface globally; assign universe per fixture in the patch
- **Patch management**:
  - Add/remove fixtures on the fly
  - Inline edit of address & universe in the patch table
  - Overlap detection to prevent DMX channel conflicts
  - Persist patch data in `patch/patch.json`, with automatic migration of legacy entries
- **Modular fixtures**:
  - Each fixture in its own folder under `/fixtures`
  - HTML template, CSS, and `config.json` declare footprint, channels, and target elements
- **Real-time rendering**:
  - Per-fixture DMX offset (`base + attr.channel - 1`)
  - RGB color mapping via `background-color`
  - Frost/glow effect as CSS `filter: blur(...)` when value > 0
- **Clean UI**: no legacy box-shadow glow; performance throttling and dynamic connect status indicator

---

## 🚀 Quick Start

1. **Clone the repo**:
   ```bash
   git clone https://github.com/SynergieOfficial/L2V-Visualizer.git
   cd L2V-Visualizer
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Run the server**:
   ```bash
   node server.js
   ```
4. **Open** `http://localhost:3000` in your browser.
5. Click **⚙️ Settings**, select your NIC, then **Apply**.
6. **Add fixtures** with their own universe & start addresses, save the patch, and watch them light up!

---

## 📁 Project Structure

```
├── fixtures/            # Fixture definitions (template.html, style.css, config.json)
├── patch/
│   └── patch.json       # Current patch data (auto-migrated & saved)
├── public/
│   ├── index.html       # Main UI
│   ├── script.js        # Client logic (WebSocket, DOM, DMX processing)
   └── style.css        # Global styles
├── server.js            # Express + WebSocket + multi-universe sACN receiver
├── package.json
└── README.md
```

---

## 🏗️ Architecture Overview

1. **sACN Input** via UDP socket(s) (one per universe)
2. **Node.js Server** (Express + `dgram` + WebSocket):
   - Serves static files and fixtures
   - `/nics` endpoint enumerates local IPv4 interfaces
   - Manages patch load/save with `patch/patch.json` (auto-migrates legacy entries)
   - Listens on each patched universe’s multicast address and broadcasts `{type:'update', universe, fixtures}`
3. **WebSocket Client** (browser):
   - Connects to selected NIC
   - Receives real-time DMX updates per-universe
   - Heartbeat-based status indicator (🟢/🔴)
   - Applies `processDMXUpdate()` to update fixture DOM elements
4. **DOM Rendering**:
   - Fixtures loaded dynamically from `/fixtures/{type}`
   - Config-driven attributes: RGB, intensity, frost (blur)

---

## 🏷️ Changelog

| Version     | Highlights                                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| v0.1        | Simple NIC and Universe settings; background color controlled by DMX.                                          |
| v0.2        | Settings cog + modal with hide-on-idle behavior.                                                               |
| v0.3        | Fixture type system: dynamic fixture loading (HTML, CSS, config).                                              |
| v0.3.1      | Modular folder structure for fixtures.                                                                         |
| v0.3.2      | **BOLT1C** fixture added with full plate and beam mapping.                                                     |
| v0.4.1      | sACN status indicator added.                                                                                   |
| v0.4.2      | Settings persistence: NIC + Universe save and load.                                                            |
| v0.4.3      | Refined settings-cog auto-hide behavior.                                                                       |
| v0.5        | Start of full patch system (remove hardcoded fixtures).                                                        |
| v0.5.8      | Dynamic address-based DMX slicing; real DMX patching finalized; **TestSquare** and **BOLT1C** live-controlled. |
| **v0.5.13** | Per-fixture Universe; inline address & universe editing; overlap detection; multi-universe sACN.               |

---

## ❗ Known Issues (v0.5.x)

- **Global Universe input** still present in UI—should be removed to avoid confusion.
- **Status indicator** sometimes remains 🟢 after sACN stops if WebSocket closes silently; needs more robust heartbeat handling.
- **Legacy patch entries** in `patch/patch.json` may not auto-migrate if file permissions prevent overwriting; manual migration might be required.
- **WebSocket lifecycle**: closing the WS on every Apply can interrupt sACN updates; implement a persistent connection or debounced Apply.
- **Performance**: rendering many fixtures (>50) can degrade framerate; throttling and virtualization planned for future releases.

---

## 🔮 Roadmap (v0.6+)

- **Spatial layout**: assign X/Y positions and group fixtures on a virtual grid
- **Art‑Net support**: ingest and parse Art‑Net alongside sACN
- **Advanced frost**: directional blur or beam-specific glow per `config.json`



---

---

## 📜 License

MIT © SynergieOfficial

