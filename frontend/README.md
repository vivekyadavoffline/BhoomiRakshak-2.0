# Bhoomi Rakshak — Frontend Application & Architecture Guide

**Bhoomi Rakshak Frontend** is a modern, high-performance web GIS and disaster resilience planning interface built with **React 19**, **Vite**, **Leaflet GIS**, **Three.js**, and **TailwindCSS / Vanilla CSS**.

It provides an interactive, responsive decision-making dashboard for disaster authorities (`/console`) and a high-accessibility emergency guide for citizens (`/citizen`).

---

## 📑 Table of Contents

1. [Key Features](#1-key-features)
2. [Tech Stack: Where Does Which Tech Do What?](#2-tech-stack-where-does-which-tech-do-what)
3. [Routes & Page Architecture](#3-routes--page-architecture)
4. [Component Architecture & Working](#4-component-architecture--working)
5. [GIS & Visualization Engines](#5-gis--visualization-engines)
6. [Citizen Emergency & Accessibility Suite](#6-citizen-emergency--accessibility-suite)
7. [Running Locally](#7-running-locally)

---

## 1. Key Features

- **Multi-Modal GIS Engine**:
  - **Leaflet 2D / Satellite GIS**: High-resolution Esri World Imagery, OpenStreetMap, and OpenTopoMap basemaps with auto-centering and smooth fly-to zoom (Level 13).
  - **3D Geological Terrain (`Terrain3D`)**: Raycasted 3D digital elevation mesh rendered via Three.js with fault lines, elevation contours, and clickable orbital zoom pins.
  - **2D Grid Matrix (`MapCanvas`)**: Abstract grid topology visualization with relocation displacement vectors.
- **Zone-Adaptive Evacuation Guidance**:
  - **Red / Yellow Danger Zones**: Real-time animated multi-hop Dijkstra corridors route evacuees to the closest Green safe haven with dynamic hazard impedance weighting and carrying capacity checks.
  - **Green Safe Zones**: Evacuation pathfinding is suppressed; displays a prominent **"✅ You Are Safe"** assurance badge noting the area is a receiving safe haven.
- **Explainable Decision Support (XAI)**: Explicit breakdown of Hazard Intensity, Vulnerability Index, and Population Exposure.
- **Statutory Climate Fund Convergence Calculator**: Aggregates XV-FC NDMF/SDMF, PMAY-G, JJM, PMGSY, and MGNREGA grants with Center-State sharing ratios (90:10 / 75:25).
- **Reverse Insurance & Economic Resilience Calculus**: Real-time quantification of proactive relocation ROI (5x–7x savings) vs. reactive post-disaster expenditure.
- **Inclusive Accessibility Suite**:
  - 🔊 **Tri-Tier Bilingual Voice Advisory (Text-to-Speech)** in English & हिन्दी (Hindi) with tailored audio alerts for Red (Immediate Evac), Yellow (Preparedness), and Green (Safety Confirmation).
  - 🔠 **Visual Font Resizer** (`[A-]`, `[A]`, `[A+]`) for low-vision users.
  - 🌐 **Instant Language Toggle**.
  - 🔴 **1-Tap Emergency SOS Speed Dial** (`112`, `1078`, `1077`, `108`, `1070`).
- **Complete Mobile-First Responsive Design**:
  - Full fluid layout across 360px–980px+ viewports with zero horizontal overflow.
  - Interactive GIS Map / 3D Canvas reordered to the top on mobile screens with compact zone list underneath.
  - Touch-friendly controls (min 42px tap targets) and 2×2 wrapping map switchers.
- **Official Print & PDF Export Isolation**: Pure CSS `@media print` DOM isolation for single-page A4 administrative planning briefs and legal certificates without UI clipping.

---

## 2. Tech Stack: Where Does Which Tech Do What?

| Technology | Category | Where Used (File / Module) | What It Does (Role & Mechanics) |
|---|---|---|---|
| **React 19** | Frontend Framework | `src/App.jsx`, `src/pages/*.jsx`, `src/components/*.jsx` | Drives reactive component rendering, state isolation (`useState`, `useEffect`, `useMemo`), and concurrent UI transitions. |
| **Vite** | Build Tool & Dev Server | `vite.config.js`, `package.json` | Powers instant sub-second Hot Module Replacement (HMR), tree-shaking, and optimized production bundle code-splitting. |
| **React Router** | Client-side Routing | `src/App.jsx` | Enables seamless, deep-linkable multi-route SPA navigation across `/`, `/console`, `/citizen`, `/dashboard`, and fallback 404 views without page reloads. |
| **Leaflet & React-Leaflet** | 2D Interactive GIS | `src/components/Map.jsx`, `src/pages/Website.jsx` | Renders interactive vector tile maps, polygon risk overlays, marker clusters, and animated Dijkstra evacuation polylines with click-to-fly zoom triggers. |
| **Esri World Imagery** | Satellite GIS Layer | `src/components/Map.jsx`, `src/pages/Website.jsx` | Streams ultra-high-resolution satellite aerial basemaps allowing authorities and citizens to inspect real-world physical terrain, rivers, and slopes. |
| **Three.js & React Three Fiber** | 3D WebGL Graphics | `src/components/Earth3D.jsx`, `src/pages/Website.jsx` | Raycasts 3D Digital Elevation Models (DEM), generates procedural contour topographies and geological fault lines with smooth orbital camera controls. |
| **Recharts** | Data Visualization | `src/components/AnalyticsPanel.jsx`, `src/components/ReverseInsurance.jsx` | Renders responsive SVG charts (radar multi-factor distributions, priority curves, 10-year proactive vs. reactive cost-benefit trajectories). |
| **Lucide React** | UI Iconography | All frontend pages & components | Supplies crisp, high-contrast SVG icons for hazard badges (flood, landslide, cyclone), transportation routes, accessibility buttons, and emergency lifelines. |
| **Web Speech API** | Voice Synthesis (TTS) | `src/pages/Website.jsx` | Native browser speech synthesizer (`SpeechSynthesisUtterance`) that broadcasts spoken disaster advisories in English and हिन्दी (Hindi). |
| **HTML5 Geolocation** | User Positioning | `src/pages/Website.jsx` | Extracts citizen latitude/longitude via `navigator.geolocation` to compute real-time Haversine distance to nearest hazard zones and designated relief shelters. |
| **Vanilla CSS & Print CSS** | Styling & Document Engine | `src/index.css`, `src/App.css` | Implements glassmorphism UI, responsive dark/light color palettes, and pure `@media print` DOM isolation for single-page A4 PDF/paper export. |
| **Axios** | HTTP Client | `src/services/api.js` | Dispatches asynchronous REST API calls to FastAPI endpoints (`/api/layers/*`, `/api/engine/*`, `/api/feedback`, `/api/model/retrain`). |

---

## 3. Routes & Page Architecture

| Route | Component | Description |
|---|---|---|
| `/` | `Website.jsx` | Public landing page, product walkthrough, interactive scenario switcher, and demo console |
| `/console` | `Website.jsx` | Authority planning desk with ranked ledger, GIS map, DPR brief, and legal certificate generator |
| `/citizen` | `Website.jsx` | Citizen resilience portal with GPS locator, safe relief shelter guide, SOS strip, and Go-Bag checklist |
| `/dashboard` | `Dashboard.jsx` | Standalone analytics dashboard with radar feeds and convective storm simulators |
| `/privacy` | `PrivacyPolicy.jsx` | Official privacy policy |
| `/terms` | `TermsAndConditions.jsx` | Terms and conditions of service |
| `*` | `NotFound.jsx` | Custom styled 404 error page |

---

## 4. Component Architecture & Working

```
frontend/src/
├── App.jsx                  # Root router configuration & lazy-loaded routes
├── index.css                # Global CSS variables, print isolation rules & typography
├── services/
│   └── api.js               # REST API client connecting to FastAPI/SQLite backend
├── data/
│   └── zonesData.js         # 1,000 accurate synthetic zones across Indian states
├── components/
│   ├── Map.jsx              # Leaflet GIS 2D / Satellite basemap wrapper
│   ├── AnalyticsPanel.jsx   # Priority charts, score breakdowns & radar distributions
│   ├── PhasingMatrix.jsx    # Phased action category grid (Immediate / Short / Medium)
│   ├── ClimateFundCalculator.jsx  # XV-FC NDMF & scheme convergence engine
│   ├── ReverseInsurance.jsx # Proactive vs. reactive cost-benefit model
│   ├── CommunityVoice.jsx   # Ground observation submission hub & model retraining loop
│   ├── Earth3D.jsx          # Interactive WebGL globe visualization
│   ├── Chatbot.jsx          # AI disaster management assistant drawer
│   └── CookieBanner.jsx     # Legal cookie consent banner
└── pages/
    ├── Website.jsx          # Main orchestrator for Landing, Console, and Citizen views
    ├── Dashboard.jsx        # Advanced meteorological & convective radar dashboard
    ├── NotFound.jsx         # 404 handler
    ├── PrivacyPolicy.jsx    # Privacy policy
    └── TermsAndConditions.jsx # Terms and conditions
```

---

## 5. GIS & Visualization Engines

### Leaflet 2D / Satellite GIS
- **Esri World Imagery**: Renders high-resolution satellite imagery for real-world slope and terrain verification.
- **Smooth Fly-To**: Automatically centers on clicked hazard zones and candidate relocation sites with smooth ease-in animation at zoom level 13.
- **Dijkstra Corridors**: Renders SVG polyline corridors with directional animated dash arrays and bearing-aligned waypoint arrows.

### Three.js 3D Digital Elevation Model (`Terrain3D`)
- Procedurally generates 3D elevation geometry using raycasted height maps.
- Visualizes elevation contour lines, active fault lines, and interactive pins that smoothly animate the orbital camera.

---

## 6. Citizen Emergency & Accessibility Suite

- **GPS Auto-Snapping**: Detects citizen coordinates via `navigator.geolocation` and computes Haversine distances to determine danger status.
- **Voice Advisory Stream**: Integrated `window.speechSynthesis` translates emergency notices into Hindi and English with live sound wave visuals.
- **72-Hour Go-Bag Checklist**: LocalStorage-persisted 8-point survival kit tracker (water, non-perishable food, waterproof document pouch, first-aid, flashlight, power bank, cash, whistle).
- **Citizen Ground Observation Hub**: Allows citizens to submit geo-tagged observations of ground fissures, slope cracks, and waterlogging.

---

## 7. Running Locally

```powershell
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

Open **`http://localhost:5173`** in your browser.