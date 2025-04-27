# Q2LED-Visualizer

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

# L2V Visualizer

A web-based visualizer for sACN DMX lighting systems.

## Project Purpose
This project aims to provide a scalable and responsive visual representation of a lighting rig, driven in real-time by sACN DMX data.

## Setup Instructions
1. Install dependencies:
```bash
npm install
```
2. Start the server:
```bash
node server.js
```
3. Access the client:
Open `http://localhost:3000` in your web browser.

## Folder Structure
- `/Fixtures/`: Contains folders for each fixture type (HTML, CSS, and configuration files).
- `/Patch/patch.json`: Stores the current patch list.
- `server.js`: Node.js backend that handles sACN, WebSocket server, and file serving.
- `script.js`: Frontend logic for managing fixtures, settings, and receiving sACN updates.
- `style.css`: Base styling.

## Version History

### v0.5.0 - Initial Visualizer Setup
- WebSocket server and client communication.
- Basic sACN receiver (UDP socket on port 5568).
- Background color visualization via DMX RGB.

### v0.5.1 - Settings Menu
- NIC selection dropdown.
- Universe input field.
- Apply button to connect to the sACN network.
- sACN status indicator.

### v0.5.2 - Patch System Started
- Read patch list from `patch.json`.
- Render patch table inside the settings modal.

### v0.5.3 - Fixture Rendering System
- Support for fixture templates and CSS loading based on type.
- Dynamic rendering of fixtures based on patch.

### v0.5.4 - Attribute Application System
- Basic attributes implemented:
  - Intensity (opacity)
  - RGB (background color)
  - Frost (blur)

### v0.5.5 - Improved Patch and Fixtures
- Added TestSquare fixture.
- Added BOLT1C fixture with full attribute mapping.

### v0.5.6 - Clean UI Improvements
- Black background.
- Responsive scaling of fixture layout.
- Settings button hiding and hover behavior.

### v0.5.7 - Server & Client Stability
- Organized server code structure.
- Improved error handling.
- Ensured reconnect behavior for WebSocket.

### v0.5.8 - Patch Saving
- Button to save the current patch into `/Patch/patch.json`.
- Added WebSocket server command to handle patch saving.

### v0.5.9 - Minor Visual Improvements
- Patch table formatting.
- NIC and Universe fields styled.
- Confirmed working patch display.

### v0.5.10 - Adding Fixtures from Frontend
- Dropdown to select fixture type from available fixtures.
- Input field for address.
- Add button to dynamically add a new fixture.
- Updated patch table live.

### v0.5.11 - Patch & Fixture Stability (Current Work)
- Improved fixture dynamic rendering.
- Refactored DMX update handling based on fixture config.
- Correct loading of patch from `/Patch/patch.json`.
- Rebuild of WebSocket message system.
- Critical bug: Fixtures are rendered visually but do not respond to sACN DMX updates yet.

## Known Issues
- Fixtures render but attributes do not update from DMX frames (working on it!).
- Settings menu may need some small CSS/JS improvements for better UX.
- Bug in current version, NIC selection dropdown is empty

---

> Next Step: Finish v0.5.11 patching and fully restore sACN visual updates to fixtures.


