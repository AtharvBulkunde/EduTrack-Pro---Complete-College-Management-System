# EduTrack Pro — run the connected full-stack app on Windows

## Included files
- `index.html` redirects to the connected application in `app.html`.
- `app.html`, `app.css`, `app.js`: responsive frontend connected to API requests.
- `api.js`: API client and session token handling.
- `server/src/server.js`: Express REST API.
- `server/src/db.js`: SQLite setup and schema for users, faculty, courses, attendance, and grades.
- `server/src/create-admin.js`: interactive administrator account setup.

## 1. Install and configure
Install Node.js 20 or newer. Open PowerShell in the project folder and run:

```powershell
cd server
Copy-Item .env.example .env
notepad .env
```

In `.env`, set `JWT_SECRET` to a long random private value of at least 32 characters. Keep it secret and never commit `.env`. The default `CLIENT_ORIGIN=http://localhost:5500` matches the default VS Code Live Server address.

## 2. Create the database and an administrator
From the `server` directory:

```powershell
npm install
npm test
npm run init-db
npm run create-admin
```

Enter the administrator’s name, email, college, and password when prompted. Use a unique email and a password of at least 12 characters. Public signup creates student accounts only; the admin command is the local bootstrap route for privileged access.

`npm test` runs an API smoke test against a disposable SQLite database and removes its test files afterward. It checks authentication, profile, attendance, grades, and admin course/faculty operations.

## 3. Start the backend
Still from `server`:

```powershell
npm run dev
```

Leave this terminal running. Visit `http://localhost:4000/api/health`; a working API returns JSON with `status: ok`.

## 4. Start the frontend
Open the repository root (the folder containing `index.html` and `app.html`) in VS Code. Use Live Server to launch `index.html` or `app.html`. It should be served from `http://localhost:5500`. The origin must match `CLIENT_ORIGIN` in `server/.env`. If your chosen port or host differs, update `CLIENT_ORIGIN` to that exact origin and restart the API.

Do not double-click the HTML file to open it as `file://`; use a local server so browser requests can reach the API.

## Current features
- Account creation and sign-in; passwords are hashed with bcrypt and sessions use expiring JWTs.
- Dashboard metrics calculated from stored records.
- Create/edit/delete attendance and grade records, scoped to the signed-in student.
- Course and faculty browsing by college; administrators can create, edit and delete courses and faculty.
- Profile editing saved to the database.
- Administrator-only student directory.
- SQLite database persistence between browser sessions and application restarts.

## API routes
Public: `GET /api/health`, `POST /api/auth/signup`, `POST /api/auth/login`.

Authenticated: `GET/PATCH /api/auth/me`, `GET /api/dashboard`, `GET/POST /api/attendance`, `DELETE /api/attendance/:id`, `GET/POST /api/grades`, `DELETE /api/grades/:id`, `GET /api/courses`, `GET /api/faculty`.

Admin-only: `GET /api/students`, `POST/PATCH/DELETE /api/courses`, `POST/PATCH/DELETE /api/faculty`.

Requests other than public health/signup/login require `Authorization: Bearer <token>`; the frontend client adds it automatically.

## Database and data safety
SQLite is stored at `server/data/edutrack.sqlite`. Back up this file before upgrading or resetting data. Do not use real student records in a public demo. Before deploying publicly, configure HTTPS, secure secret management, automated backups, monitoring, and a production database suitable for multiple server instances.
