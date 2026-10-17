require("dotenv").config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("Missing/weak JWT_SECRET. Copy .env.example to .env and set a random secret of at least 32 characters.");
  process.exit(1);
}

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { requireAuth } = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const recordsRoutes = require("./routes/records");
require("./db");

const app = express();
const port = Number(process.env.PORT || 4000);
const origins = (process.env.CLIENT_ORIGIN || "http://localhost:5500").split(",").map(s => s.trim());

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: origins, credentials: false }));
app.use(express.json({ limit: "100kb" }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
app.get("/api/health", (req, res) => res.json({ status: "ok", service: "edutrack-pro-api" }));
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/signup", loginLimiter);
app.use("/api/auth", authRoutes);
app.use("/api", requireAuth, recordsRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  if (String(err.code || "").startsWith("SQLITE_CONSTRAINT")) {
    return res.status(409).json({ error: "The record conflicts with existing data." });
  }
  res.status(500).json({ error: "Unexpected server error. Check the server terminal for details." });
});

app.listen(port, () => console.log(`EduTrack Pro API running at http://localhost:${port}`));
