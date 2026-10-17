# EduTrack Pro API (Node.js + SQLite)

This API adds a real server-side database instead of using browser `localStorage` as the source of truth.

## Requirements
- Node.js 20+
- npm

## Windows PowerShell setup
```powershell
cd server
Copy-Item .env.example .env
```

Open `server/.env` and set `JWT_SECRET` to a random secret of at least 32 characters. Keep `.env` private.

Then run:
```powershell
npm install
npm run init-db
npm run dev
```

The API listens on `http://localhost:4000`; the SQLite database is created at `server/data/edutrack.sqlite`. Keep that file backed up.

Serve the existing `index.html` from a local web server (for example VS Code Live Server on port 5500) so the browser origin matches `CLIENT_ORIGIN`. Do not open the file directly using `file://`.

## Endpoints
- `GET /api/health` — health check (public)
- `POST /api/auth/signup` — create account
- `POST /api/auth/login` — sign in using student ID, college and password
- `GET /api/auth/me`, `PATCH /api/auth/me` — profile
- `GET /api/dashboard` — dashboard counts
- `GET/POST /api/attendance`, `DELETE /api/attendance/:id`
- `GET/POST /api/grades`, `DELETE /api/grades/:id`
- `GET /api/courses`, `POST /api/courses` (admin only)
- `GET /api/faculty`, `POST /api/faculty` (admin only)
- `GET /api/students` (admin only)

All requests except health, signup and login require `Authorization: Bearer <token>`.

## Security and deployment notes
- Passwords are hashed using bcrypt; plain-text passwords are never returned.
- JWTs expire after 8 hours. The current HTML demo still contains legacy localStorage logic; wire it to this API using `api.js` before treating all UI screens as persistent server-backed features.
- New accounts default to the `student` role. Do not grant admin privileges from a public signup form.
- SQLite is suitable for local development and a small single-instance deployment. For a public production deployment, configure HTTPS, strong secrets, backups, and consider PostgreSQL.
