# Bhoomi Rakshak - 3 Minute AZINHACK '26 Live Demo Script

**Target Audience:** AZINHACK '26 Jury
**Goal:** Show a complete relocation workflow and prove that TinyFish is functional, relevant, and visible in the product.

---

### Step 1: The Problem & Dashboard Overview (0:00 - 0:30)

- **Action**: Open the dashboard (`http://localhost:5173`).
- **Talk Track**: "Welcome to Bhoomi Rakshak. Disaster management today is reactive. We wait for a landslide, then scramble to relocate people. Our platform makes this proactive by fusing hazard maps (red), vulnerable habitations, and safe relocation sites (green) onto a single GIS pane of glass."

### Step 2: Triggering the AI-GIS Engine (0:30 - 1:15)

- **Action**: Click the blue "RUN ANALYTICS ENGINE" button in the top right.
- **Talk Track**: "When disaster-management teams receive new predictive weather or hazard data, they click 'Run Analytics Engine'. The backend cross-references spatial hazard intensity with demographic vulnerability, computes a Priority Score, and matches habitations to candidate safe sites."

### Step 3: Explainable AI & Map Exploration (1:15 - 2:15)

- **Action**: Click on one of the bright red polygons (Immediate Phase Habitations) on the map.
- **Talk Track**: "The engine has prioritized the zones. Let's inspect Habitation X. The dashboard shows an Explainable AI (XAI) breakdown. It's not a black box—the judge can see exactly _why_ this zone was marked 'Immediate': it has a high hazard score, extreme vulnerability, and we can see exactly which safe site it was assigned to without exceeding capacity."

### Step 4: Phasing Matrix & Legal Execution (2:15 - 3:00)

- **Action**: Scroll the left panel down to the "Relocation Phasing Matrix". Find an Immediate phase zone and click "Certificate".
- **Talk Track**: "Finally, analytics must translate to action. Our Phasing Matrix acts as a triage board. For an Immediate Red Zone, the authority can click to generate a tamper-proof Legal Certificate."
- **Action**: Show the downloaded PDF.
- **Talk Track**: "This PDF is dynamically generated, includes the XAI justification, the assigned relocation site, and a blockchain-ready SHA-256 audit hash to ensure transparency in relocation fund allocation."

### TinyFish proof point (use within Step 3 or Step 4)

- **Action**: Open the unified assistant and ask: `What are the red zones in Delhi?`
- **Talk Track**: "Bhoomi Rakshak checks its internal project records first. When the question needs current external evidence, TinyFish searches the live web through our backend proxy. The response combines local zone records with relevant live sources and renders them as readable evidence cards."
- **Action**: Open `/intel` and run `latest disaster risk updates in India`.
- **Talk Track**: "This is the dedicated TinyFish workspace. It shows the live source matrix and cards, making the mandatory integration easy to verify."

### (Bonus) What's Mocked vs Real?

- "The UI, FastAPI or Express backend, SQLite database, TinyFish proxy, and PDF generation are fully functional."
- "We are using synthetic generated GeoJSON data for the map layers since we don't have live API access to NRSC/Bhuvan yet, but the engine is built to accept real standard GeoJSON."
