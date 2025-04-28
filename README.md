# L2V-Visualizer

A web-based lighting visualizer for festival-grade DMX rigs. Mirror real sACN DMX inputs in the browser, patch fixtures live, and preview your show virtually.

---

## 🔹 Features

- **Live sACN input** over UDP (port 5568) with real DMX parsing
- **Network Interface (NIC) selection**: dynamically populated dropdown
- **Universe selection**: choose and apply DMX universe at runtime
- **Patch management**:
  - Add/remove fixtures on the fly
  - Persist patch data in `patch/patch.json`
  - Auto-save via WebSocket on add/save
- **Modular fixtures**:
  - Each fixture in its own folder under `/fixtures`
  - HTML template, CSS, and `config.json` declare footprint, channels, and target elements
- **Real-time rendering**:
  - Per-fixture DMX offset (`base + channel - 1`)
  - RGB color mapping via background-color
  - Frost/glow effect as CSS `filter: blur(...)` when DMX > 0
- **Clean UI**: no legacy box-shadow glow; performance throttling and UI improvements

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
5. Click **⚙️ Settings**, select your NIC and universe, then **Apply**.
6. **Add fixtures**, save the patch, and watch them light up!

---

## 📁 Project Structure

```
├── fixtures/            # Fixture definitions (template.html, style.css, config.json)
├── patch/
│   └── patch.json       # Current patch data (auto-read/write)
├── public/
│   ├── index.html       # Main UI
│   ├── script.js        # Client logic (WebSocket, DOM, DMX processing)
│   └── style.css        # Global styles
├── server.js            # Express + WebSocket + sACN receiver
├── package.json
└── README.md
```

---

## 🏗️ Architecture Overview

1. **sACN Input** via UDP socket (port 5568)
2. **Node.js Server** (Express + `dgram`):
   - Serves static files
   - `/nics` endpoint enumerates local IPv4 interfaces
   - `/fixtures` lists available fixture types
   - WebSocket server broadcasts DMX updates to clients
3. **WebSocket Client** (browser):
   - Requests NIC/universe connect
   - Receives real-time DMX arrays per fixture
   - Applies `processDMXUpdate`
4. **DOM Rendering**:
   - Fixtures dynamically loaded from `/fixtures/{type}`
   - Config-driven attributes: RGB, intensity, frost

---

## 🏷️ Changelog

| V0.1 | Simple NIC and Universe Settings. Background Color controlled by DMX. |
| V0.2 | Settings Cog + Modal with Hide-on-Idle behavior. |
| V0.3 | Fixture Type System: Dynamic Fixture Loading (HTML, CSS, Config). |
| V0.3.1 | Modular folder structure for fixtures. |
| V0.3.2 | BOLT1C fixture added with full plate and beam mapping. |
| V0.4.1 | sACN Status Indicator added. |
| V0.4.2 | Settings Persistence: NIC + Universe save and load. |
| V0.4.3 | Refined Cog Auto-Hide Behavior. |
| V0.5 | Start full Patch System (remove hardcoded fixtures). |
| V0.5.8 | Dynamic Address-Based DMX Slicing. Real DMX patching finalized. TestSquare and BOLT1C fully live-controlled. |

### [0.5.11] – 2025-04-28

**🚀 Features**
- NIC dropdown populated via `/nics` endpoint
- sACN receiver binds to the selected NIC & universe, with console log on connect
- Live-Add Fixture immediately WebSocket-saves so new fixtures light up without manual save
- Patch persistence fully under `patch/patch.json` (load + save)
- Real DMX parsing: last 512 bytes → DMX array for universe
- Per-fixture offset: `base + (attr.channel–1)` ensures correct channel mapping
- Frost effect now CSS `filter: blur(...)` only when value > 0
- Removed legacy box-shadow glow; clean RGB background-color mapping

**🛠 Bugfixes**
- Fixed incorrect patch path casing (`/Patch/` → `/patch/`)
- Removed per-packet spam logging, now only logs on connect & save
- Corrected nested attribute targeting in `processDMXUpdate`

---

## 🔮 Roadmap (v0.6+)

- **Spatial layout**: assign X/Y positions and group fixtures on a virtual grid
- **Multi-universe**: support patching & rendering across multiple DMX universes
- **Advanced frost**: directional blur or box-shadow accents per `config.json`
- **Art-Net support**: ingest and parse Art-Net packets in addition to sACN
- **Performance metrics**: FPS counter, throttling strategies

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch
3. Submit a PR with clear description & testing steps
4. Discuss on issues and iterate

---

## 📜 License

MIT © SynergieOfficial

