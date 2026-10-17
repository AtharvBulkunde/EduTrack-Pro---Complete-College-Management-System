# EduTrack Pro — Complete College Management System

EduTrack Pro is a college-management web application with a database-backed frontend and a Node.js API.

## Main application
- **`app.html`** — database-connected UI (sign in/sign up, dashboard, attendance, grades, courses, faculty, student directory for admins, and profile).
- `app.css` — responsive dark campus dashboard UI.
- `app.js` — application screens and API-backed form handlers.
- `api.js` — fetch client for the backend.

## Backend
- `server/` — Express API, SQLite database, bcrypt password hashing, JWT authentication, validation, and admin-only actions.
- `FULL_STACK_SETUP.md` — Windows setup guide.
- `server/README.md` — API endpoint reference and local development instructions.

## Start the app on Windows
1. Install Node.js 20+.
2. In PowerShell, run `cd server`, then `Copy-Item .env.example .env`.
3. Edit `server/.env` and set `JWT_SECRET` to a random value with at least 32 characters.
4. Run `npm install`, then `npm run init-db`.
5. Create an admin account using `npm run create-admin` when prompted.
6. Start the API with `npm run dev`.
7. In another terminal, open the repository root in VS Code and launch `app.html` with Live Server on port 5500. The origin must match `CLIENT_ORIGIN` in `server/.env`.

The SQLite database is created under `server/data/` and survives browser refreshes and app restarts. Do not commit `.env`, database files, access tokens, or real student data. For internet-facing production deployments, use HTTPS, strong secrets, access controls, backups and a managed database.
