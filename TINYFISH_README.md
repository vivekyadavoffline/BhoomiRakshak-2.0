# TinyFish Integration

## Purpose

Bhoomi Rakshak uses TinyFish as a functional live-web research layer for disaster-risk and relocation planning. It is used when the internal project knowledge base does not contain a sufficient answer or when the user asks for current information.

## User Flow

1. The unified assistant receives a question.
2. It checks the internal Bhoomi Rakshak knowledge base and backend assistant first.
3. Current or uncovered questions are converted into a concise, project-focused search intent.
4. The backend sends that intent to TinyFish Search through a server-side proxy.
5. Local project records and live web sources are combined when a location query matches app data, such as Delhi red zones.
6. The frontend renders one useful answer with readable source cards. Internal implementation prompts and raw CLI metadata are never shown to the user.

## Integration Points

| Surface             | Role                                                                             |
| ------------------- | -------------------------------------------------------------------------------- |
| Unified chatbot     | Internal-first answers with TinyFish fallback for current or uncovered questions |
| Delhi red-zone flow | Combines local immediate-action zone records with current supporting web sources |
| `/intel`            | Dedicated TinyFish research workspace with source matrix and evidence cards      |
| Notifications       | Successful live research creates a visible update in the authority console       |
| Backend proxy       | Keeps `TINYFISH_API_KEY` out of the browser and frontend bundle                  |

## Backend Endpoint

`POST /api/tinyfish/search`

Request:

```json
{
  "query": "official Delhi India disaster hazard red zones flood landslide risk maps NDMA IMD"
}
```

Response shape:

```json
{
  "query": "...",
  "results": "..."
}
```

The endpoint is available through either backend implementation:

- Python: `backend/app/tinyfish_service.py`
- JavaScript fallback: `backend/js-server/server.mjs`

## Configuration

Keep the real key in the ignored `backend/.env` file:

```env
TINYFISH_API_KEY=your_key_here
```

For collaborators, copy `backend/.env.example` and set the key locally. Never place the key in React code, public assets, screenshots, or README files.

## Run the JavaScript Fallback

Use this when Python is unavailable:

```powershell
cd backend/js-server
npm install
npm start
```

The proxy listens on `http://localhost:8000`. Start the frontend separately:

```powershell
cd frontend
npm install
npm run dev
```

## Judge-Visible Proof

Use this sequence in the demo:

1. Ask the unified assistant: `What are the red zones in Delhi?`
2. Show local Bhoomi Rakshak zone records plus TinyFish source cards.
3. Ask: `What are the latest disaster-risk updates for Delhi?`
4. Open `/intel` and run a current India disaster-risk query.
5. Show the source matrix, links, summaries, and the notification created by the live search.

This demonstrates that TinyFish is relevant to the product, functional, server-integrated, and visible in a real disaster-planning workflow.
