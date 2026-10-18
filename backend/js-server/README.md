# JavaScript TinyFish fallback

Use this Express proxy when Python is unavailable:

```powershell
cd backend/js-server
npm install
npm start
```

The server reads `TINYFISH_API_KEY` from `backend/.env` and exposes the same endpoint used by the frontend:

`POST http://localhost:8000/api/tinyfish/search`

Request body:

```json
{ "query": "latest disaster risk updates in India" }
```
