# EduTrack Pro API

The Express API powers the database-connected frontend in the repository root.

## Windows setup
```powershell
cd server
Copy-Item .env.example .env
notepad .env
npm install
npm test
npm run init-db
npm run create-admin
npm run dev
```

`npm test` runs the database-backed API smoke tests with a temporary test database. Set a private `JWT_SECRET` of at least 32 characters in `.env`. The default client origin is `http://localhost:5500`; keep it aligned with the local frontend server. Open the repository root in VS Code and launch `index.html` using Live Server. Test the API at `http://localhost:4000/api/health`.

## Routes
- Public: `GET /api/health`, `POST /api/auth/signup`, `POST /api/auth/login`.
- Authenticated: `GET/PATCH /api/auth/me`, `GET /api/dashboard`, `GET/POST /api/attendance`, `DELETE /api/attendance/:id`, `GET/POST /api/grades`, `DELETE /api/grades/:id`, `GET /api/courses`, `GET /api/faculty`.
- Admin only: `GET /api/students`, `POST/PATCH/DELETE /api/courses`, `POST/PATCH/DELETE /api/faculty`.

Protected requests use `Authorization: Bearer <token>`. Public signup always creates a student; use `npm run create-admin` on the local server to bootstrap the first administrator. Passwords are hashed using bcrypt. SQLite persists data in `server/data/edutrack.sqlite`.

For public hosting, use HTTPS, secure secrets, backups, rate limiting, and a production database strategy. Never commit `.env`, user data, or database files.
