# L2V Visualizer

**Version:** 0.5.8  
**Author:** SynergieOfficial  

---

## 🎯 Project Scope and Goals

The L2V Visualizer is built to emulate real-world lighting fixtures visually on large LED screens at festivals or events.  
It visually mimics lighting effects by interpreting sACN DMX input and applying it to dynamically generated HTML/CSS elements.

The goals are:
- **Dynamic:** No hardcoding of fixture logic.
- **Scalable:** Easily handle 10–100–500 fixtures without growing complexity.
- **Realistic:** Fixtures should behave similarly to their real-life counterparts.
- **Future-proof:** Add new fixture types without touching core code.

---

## 📋 System Architecture

| Component | Role |
|:----------|:-----|
| `/server.js` | Receives sACN DMX packets, sends live DMX state to browser clients via WebSocket. |
| `/public/index.html` | Main webpage structure. |
| `/public/script.js` | Handles fixture loading, DMX reacting dynamically based on config.json. |
| `/fixtures/` | Directory containing each fixture type’s files (HTML template, CSS, DMX config). |
| `/patch/patch.json` | List of patched fixtures: fixtureType, start address, and internal ID. |

---

## 📜 Project Evolution

| Version | Description |
|:--------|:------------|
| **V0.1** | First connection to sACN DMX. WebSocket setup. 3 channels controlling webpage background color. |
| **V0.2** | Settings modal added. NIC and Universe selection. WebSocket reconnecting after Apply. |
| **V0.3** | First fixture system introduced. Fixtures hardcoded into the frontend (TestSquare, BOLT1C). |
| **V0.3.1** | Fixtures moved into folders (`fixtures/FixtureName/`). Config.json, template.html, and style.css separated per fixture. |
| **V0.4.x** | UI improvements (settings icon behavior, NIC saving, sACN connection heartbeat). BOLT1C fixture visual improved slightly. |
| **V0.5.0** | PATCH system added. Client now loads fixtures dynamically based on patch.json. TestSquare and BOLT1C hardcoded DMX removed. |
| **V0.5.3** | Client started interpreting fixture configs dynamically (basic attributes). |
| **V0.5.5** | Full modular dynamic fixture system built. Each fixture defines its own behavior using attributes in config.json. |
| **V0.5.7** | Final cleanup: new template structure, clean `data-element` attributes removed, element ID usage reintroduced for easier linking. |
| **Current (V0.5.8)** | Full project standardization. All DMX control is attribute-driven. No hardcoded logic. Ready for scaling to many fixture types! |


## 🎛️ How Fixtures Work

Each fixture type lives inside `/fixtures/FixtureName/` and includes:

| File | Purpose |
|:-----|:--------|
| `template.html` | Defines the fixture’s structure (important: element IDs!) |
| `style.css` | Defines how the fixture looks visually. |
| `config.json` | Defines how DMX controls each element. |

At runtime:
- The browser loads the correct template and styling.
- Reads the DMX mapping from `config.json`.
- Applies DMX live to fixture elements automatically.

✅ No fixture-specific code in the core script.js!

---

## 🛠️ Fixture Config Philosophy

Fixtures mimic real-world devices but use only the attributes needed for visual effect:

| Supported Attribute Types | Description |
|:---------------------------|:------------|
| `intensity` | Controls opacity (1 channel). |
| `rgb` | Controls background color (3 channels: R, G, B). |
| `frost` | Adds glow (box-shadow) based on DMX value (1 channel). |
| `intensity+rgb` | (Configured separately if needed, combining both behaviors). |

### 📋 Example `config.json`

```json
{
  "footprint": 40,
  "attributes": [
    {
      "type": "frost",
      "channel": 1,
      "elements": ["Plate1", "Plate2", "Beam1", "Beam2", ...]
    },
    {
      "type": "intensity",
      "channel": 2,
      "elements": ["Main"]
    },
    {
      "type": "rgb",
      "channel": 9,
      "elements": ["Plate1"]
    },
    ...
  ]
}
