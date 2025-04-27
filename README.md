# 🎧 L2V-Visualizer

## Scope

The L2V-Visualizer is a festival-grade lighting visualization engine designed to emulate real-life fixtures onto LED walls and large screens.  
It allows live DMX/sACN control of virtual lighting fixtures, dynamically expanding the real-world rig with visual augmentation.

👉 Receives live sACN DMX data  
👉 Patches fixtures dynamically  
👉 Modular fixture system (HTML, CSS, config per fixture)  
👉 Frost, RGB, Intensity, and Intensity+RGB supported  
👉 Live WebSocket DMX updating  
👉 Dynamic address slicing per fixture  

---

## 🎯 Fixture Config Philosophy

Each fixture defines:

- `footprint`: total number of DMX channels it uses (real world accurate)
- `attributes`: list of attributes like `intensity`, `rgb`, `frost`
- `channel`: starting DMX channel for the attribute
- `elements`: list of HTML element IDs to apply DMX changes onto

Fixture templates have:

- HTML markup (template.html)
- CSS styling (style.css)
- ID references for DMX-controlled parts

### Frost Handling
- Frost attributes can affect **multiple elements together** (plates, beams, etc.)
- Directional or global frost glow simulated via box-shadow with adjustable opacity.

### Dynamic Address Slicing
- Every fixture receives its own **correct slice** of the incoming DMX universe based on its **starting address** and **footprint**.
- Fixture IDs are either assigned manually or auto-generated (`fixture-<address>` fallback).

### Real World Patching
- Fixtures are patched at their real DMX start addresses.
- Total footprint ensures visualizer behaves predictably compared to real lighting desks.

---

## 🛠️ Current Architecture Overview

```
sACN DMX Input
    ↓
Node.js Server (UDP Listener)
    ↓
Dynamic Fixture Patch Loader
    ↓
WebSocket Broadcast to Clients
    ↓
Client Receives Patch and DMX
    ↓
Client Injects Fixtures (Template + CSS + Config)
    ↓
Client Applies Live Visual Changes (RGB, Frost, Intensity)
```

---

## 🚀 Project Evolution

| Version | Description |
|:--------|:------------|
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

---

## 📋 How To Run

1. Install Node.js and NPM
2. Install dependencies:

```bash
npm install
```

3. Start server:

```bash
node server.js
```

4. Open browser:

```
http://localhost:3000
```

5. Apply NIC + Universe via UI
6. Start sending sACN DMX to the server
7. Watch virtual fixtures react live 🞧

---

👉 You are now running a festival-grade visualizer, ready to expand fixture libraries, patch grids, and extend your lighting creativity!

---

