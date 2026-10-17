# EduTrack Pro — full-stack setup

## What was added
- `server/`: Express API, input validation, JWT authentication, bcrypt password hashing, rate-limited login routes and SQLite database schema.
- `api.js`: reusable frontend API client.
- `server/.env.example` and setup documentation.
- New files are on branch `feature/full-stack-backend`; the original `index.html` is not overwritten.

## Important current limitation
The existing `index.html` has a large all-in-one frontend script that reads and writes students, courses, attendance, grades and faculty through browser `localStorage`. That means it is currently a front-end demo, not yet fully connected to the API. This change adds the backend foundation and API client but intentionally does not claim that every screen is already using persistent database storage. Migrate each page's load/save handler to `window.EduTrackAPI` and remove localStorage record storage before deploying.

## Run locally on Windows
1. Install Node.js 20 or newer.
2. In PowerShell, run:
   ```powershell
   cd server
   Copy-Item .env.example .env
   notepad .env
   ```
3. Replace `JWT_SECRET` with a private random value of at least 32 characters.
4. Install and initialize:
   ```powershell
   npm install
   npm run init-db
   npm run dev
   ```
5. Serve the repository root via VS Code Live Server on port 5500 (or change `CLIENT_ORIGIN` to your chosen origin).
6. Test `http://localhost:4000/api/health`; it should return `{"status":"ok","service":"edutrack-pro-api"}`.

## Basic API test
Create account (password must be at least 8 characters):
```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/auth/signup -ContentType "application/json" -Body '{"firstName":"Test","lastName":"Student","college":"engineering","email":"student@example.com","password":"ChangeThisPassword123"}'
```
Use the returned `id` and token. Do not share the returned token.

## Database tables
`users`, `faculty`, `courses`, `attendance`, `grades`; foreign keys and indexes are enabled.

## Before public deployment
- Use HTTPS and a strong random secret.
- Configure a production database and backups.
- Add a protected admin creation workflow; public signup only creates student accounts.
- Add tests and migrate all remaining UI handlers to the API.
- Never commit `.env` or database files.
