# Testing Guide

## Frontend Checks

Run from `frontend/`:

```powershell
npm run build
npm run lint
```

`npm run build` must complete successfully. `npm run lint` should have no unused-import warnings in the files touched by a change. Existing architectural warnings should be reviewed before production release.

## Local Smoke Test

Start the frontend:

```powershell
cd frontend
npm run dev -- --host 0.0.0.0
```

Open `http://localhost:5173` and verify:

1. Landing page loads without a blank canvas.
2. Hero buttons scroll and launch the planning console.
3. Demo section changes scenarios and advances through all four steps.
4. Demo process log reaches `Walkthrough complete`.
5. Console opens in Authority mode on Overview.
6. District filter changes the visible planning areas.
7. Ranked zone selection updates the map and detail panel.
8. Risk map markers open the selected zone.
9. Flood, Landslide, Earthquake, and Extreme rainfall controls toggle independently.
10. Multi-Hazard Fusion changes composite risk and risk level.
11. Fusion Analysis shows individual percentages and overlap count.
12. Site Suitability shows the score, eight factors, and recommendation.
13. 3D terrain, 2D grid, and Risk map modes render.
14. Google Maps opens for the selected zone.
15. Citizen mode shows local risk context and alert controls.
16. Citizen feedback accepts a category and appears in the feedback list.
17. Authority certificate modal opens and print/save action works.
18. Unified assistant answers documented Bhoomi Rakshak questions from internal knowledge without requiring TinyFish.
19. Ask `What are the red zones in Delhi?` and verify local zone records plus TinyFish source cards appear.
20. Open `/intel`, run a current India disaster-risk query, and verify readable source cards appear without raw CLI metadata.

## Backend and Database Checks

When Docker Desktop is running, start the full stack from the repository root:

```powershell
docker compose up --build
```

Verify:

- Frontend: `http://localhost:5173`
- API docs: `http://localhost:8000/docs`
- API root: `http://localhost:8000/`
- PostGIS container is running

Seed data with:

```powershell
docker exec -it bhoomi_rakshak_backend bash -c "python /app/scripts/seed_data.py"
```

## Known Warnings

- Vite reports a large JavaScript bundle because the prototype includes Three.js, Leaflet, Recharts, and React in the main bundle. Code splitting is a future optimization.
- The frontend currently contains synthetic planning data when the API is unavailable.
- Full Docker validation requires Docker Desktop's engine to be running.
- TinyFish checks require `backend/.env` with `TINYFISH_API_KEY` and either the Python or JavaScript backend running on port `8000`.
