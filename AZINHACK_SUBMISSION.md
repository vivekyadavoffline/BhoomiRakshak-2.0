# AZINHACK '26 Submission Pack

## Project

**Bhoomi Rakshak 2.0** is a disaster-risk and relocation decision-support platform for Indian authorities and citizens. It combines hazard mapping, vulnerability scoring, evacuation routing, safe-site matching, live weather, community reports, and explainable relocation records.

## TinyFish Integration

TinyFish is a functional live-web research layer, not a decorative mention.

- The unified assistant checks Bhoomi Rakshak's internal project knowledge first.
- For current or uncovered questions, the backend sends a concise, project-focused search to TinyFish.
- Location-aware questions such as "red zones in Delhi" combine local Bhoomi Rakshak records with current TinyFish sources.
- Results are rendered as source cards with titles, links, summaries, and a live-source status.
- The dedicated TinyFish workspace is available at `/intel`.
- The API key stays server-side in `backend/.env` as `TINYFISH_API_KEY`.

## Two-Minute Demo

1. Open the landing page and launch the console.
2. Show the ranked red-zone ledger and select a Delhi zone.
3. Show the live weather sync and explain the priority score.
4. Open the assistant and ask: `What are the red zones in Delhi?`
5. Show the internal project records combined with TinyFish live supporting sources.
6. Ask a current question such as: `What are the latest disaster-risk updates for Delhi?`
7. Open `/intel` and show the source matrix and readable evidence cards.
8. Return to the selected zone and generate a legal relocation certificate.
9. Close with the citizen portal and evacuation/safe-haven workflow.

## AZINHACK Scoring Map

| Criterion              | Bhoomi Rakshak evidence                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| Working GitHub project | React/Vite frontend, FastAPI or Express fallback, SQLite database, seeded data, API docs            |
| TinyFish integration   | Unified internal-first assistant, TinyFish live fallback, `/intel` research workspace, source cards |
| Social media post      | Add the public post URL below with a short demo clip                                                |
| Technique              | GIS layers, Three.js terrain, SQLAlchemy, explainable scoring, Dijkstra routing                     |
| Innovation             | Proactive relocation planning joins hazard, vulnerability, safe sites, finance, and legal execution |
| Impact                 | Supports district authorities and citizens before disasters become emergencies                      |
| Demo video             | Record the timed flow in this document and show the TinyFish response visibly                       |

## Submission Links

- GitHub: `ADD_PUBLIC_GITHUB_URL`
- Demo video: `ADD_PUBLIC_VIDEO_URL`
- Social post: `ADD_PUBLIC_SOCIAL_POST_URL`
- Unstop submission: https://unstop.com/hackathons/azinhack-2026-university-school-of-automation-robotics-usar-guru-gobind-singh-indraprastha-university-ggsipu--1763832

## Run Locally

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

### JavaScript backend with TinyFish

Use this when Python is unavailable:

```powershell
cd backend/js-server
npm install
npm start
```

The server reads `backend/.env` and exposes `POST /api/tinyfish/search` on port `8000`.

### Python backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Seed the pan-India SQLite dataset with `python scripts/seed_india_data.py`.

## Final Checklist

- [ ] Repository is public and the README explains setup and TinyFish.
- [ ] `backend/.env` is never committed; use `backend/.env.example` for collaborators.
- [ ] TinyFish key works on the demo machine.
- [ ] Demo video is 2-3 minutes and visibly includes TinyFish.
- [ ] Social post is public and includes the repository link.
- [ ] All links open in an incognito browser.
- [ ] Submission is complete before 18 October 2026.
