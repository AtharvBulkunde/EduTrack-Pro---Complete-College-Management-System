const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const signupSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  college: z.enum(["engineering", "medical", "business", "law", "arts"]),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  department: z.string().trim().min(1).max(100).optional().default("Computer Engineering"),
  year: z.coerce.number().int().min(1).max(6).optional().default(1)
});

const loginSchema = z.object({
  id: z.string().trim().min(3).max(32),
  college: z.enum(["engineering", "medical", "business", "law", "arts"]),
  password: z.string().min(1).max(128)
});

function publicUser(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    college: row.college,
    email: row.email,
    phone: row.phone,
    dob: row.dob,
    bloodGroup: row.blood_group,
    department: row.department,
    year: String(row.year),
    role: row.role
  };
}

function issueToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "8h" });
}

router.post("/signup", async (req, res, next) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Please check the signup details.", details: parsed.error.flatten() });
    const body = parsed.data;
    const email = body.email.toLowerCase();
    if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const prefix = ({ engineering: "ENG", medical: "MED", business: "BUS", law: "LAW", arts: "ART" })[body.college];
    const idYear = new Date().getFullYear();
    const passwordHash = await bcrypt.hash(body.password, 12);

    // Use a write transaction and the highest existing suffix, so concurrent
    // registrations cannot generate the same ID and deleted IDs are not reused.
    const createStudent = db.transaction(() => {
      const prefixForYear = prefix + idYear;
      const rows = db.prepare("SELECT id FROM users WHERE college = ? AND id GLOB ?").all(body.college, prefixForYear + "[0-9]*");
      let highest = 0;
      for (const row of rows) {
        if (!row.id.startsWith(prefixForYear)) continue;
        const suffix = row.id.slice(prefixForYear.length);
        if (suffix.length > 0 && [...suffix].every(char => char >= "0" && char <= "9")) {
          highest = Math.max(highest, Number(suffix));
        }
      }
      const id = prefixForYear + String(highest + 1).padStart(3, "0");
      db.prepare(`
        INSERT INTO users (id, first_name, last_name, college, email, password_hash, department, year)
        VALUES (@id, @firstName, @lastName, @college, @email, @passwordHash, @department, @year)
      `).run({ id, ...body, email, passwordHash });
      return id;
    });
    const id = createStudent.immediate();
    const user = publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
    res.status(201).json({ user, token: issueToken(user) });
  } catch (error) {
    if (String(error.code || "").startsWith("SQLITE_CONSTRAINT")) {
      return res.status(409).json({ error: "An account with these details already exists. Please check your email and try again." });
    }
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Enter your student ID, college and password." });
    const { id, college, password } = parsed.data;
    const row = db.prepare("SELECT * FROM users WHERE id = ? AND college = ?").get(id, college);
    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
      return res.status(401).json({ error: "Invalid student ID, college or password." });
    }
    const user = publicUser(row);
    res.json({ user, token: issueToken(user) });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.auth.sub);
  if (!row) return res.status(404).json({ error: "Account not found." });
  res.json({ user: publicUser(row) });
});

router.patch("/me", requireAuth, (req, res, next) => {
  try {
    const schema = z.object({
      firstName: z.string().trim().min(1).max(80).optional(),
      lastName: z.string().trim().min(1).max(80).optional(),
      phone: z.string().trim().max(40).optional(),
      dob: z.string().trim().max(20).optional(),
      bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(),
      department: z.string().trim().max(100).optional(),
      year: z.coerce.number().int().min(1).max(6).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid profile details.", details: parsed.error.flatten() });
    const fields = {
      firstName: "first_name", lastName: "last_name", phone: "phone", dob: "dob",
      bloodGroup: "blood_group", department: "department", year: "year"
    };
    const values = parsed.data;
    const sets = Object.keys(values).map(key => fields[key] + " = @" + key);
    if (sets.length) db.prepare("UPDATE users SET " + sets.join(", ") + " WHERE id = @id").run({ ...values, id: req.auth.sub });
    res.json({ user: publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(req.auth.sub)) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
