const express = require("express");
const { z } = require("zod");
const db = require("../db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
const semesterSchema = z.coerce.number().int().min(1).max(8);

router.get("/dashboard", (req, res) => {
  const userId = req.auth.sub;
  const attendanceRows = db.prepare("SELECT total_classes, attended_classes FROM attendance WHERE student_id = ?").all(userId);
  const total = attendanceRows.reduce((sum, row) => sum + row.total_classes, 0);
  const attended = attendanceRows.reduce((sum, row) => sum + row.attended_classes, 0);
  const user = db.prepare("SELECT college FROM users WHERE id = ?").get(userId);
  const courses = db.prepare("SELECT COUNT(*) AS n FROM courses WHERE college = ?").get(user.college).n;
  const grades = db.prepare("SELECT COUNT(*) AS n FROM grades WHERE student_id = ?").get(userId).n;
  res.json({
    attendancePercent: total ? Math.round(attended / total * 100) : 0,
    courseCount: courses,
    gradeCount: grades,
    attendanceRecords: attendanceRows.length
  });
});

router.get("/attendance", (req, res) => {
  const parsed = semesterSchema.safeParse(req.query.semester ?? 1);
  if (!parsed.success) return res.status(400).json({ error: "Semester must be between 1 and 8." });
  const rows = db.prepare("SELECT id, student_id AS studentId, semester, course_code AS code, course_name AS name, faculty, total_classes AS total, attended_classes AS attended FROM attendance WHERE student_id = ? AND semester = ? ORDER BY id").all(req.auth.sub, parsed.data);
  res.json({ records: rows });
});

router.post("/attendance", (req, res) => {
  const schema = z.object({
    semester: semesterSchema,
    code: z.string().trim().min(1).max(30),
    name: z.string().trim().min(1).max(120),
    faculty: z.string().trim().max(120).default(""),
    total: z.coerce.number().int().min(0).max(10000),
    attended: z.coerce.number().int().min(0).max(10000)
  }).refine(value => value.attended <= value.total, { message: "Attended classes cannot exceed total classes." });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid attendance record.", details: parsed.error.flatten() });
  const row = parsed.data;
  try {
    const result = db.prepare(`
      INSERT INTO attendance (student_id, semester, course_code, course_name, faculty, total_classes, attended_classes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(student_id, semester, course_code) DO UPDATE SET
        course_name=excluded.course_name, faculty=excluded.faculty,
        total_classes=excluded.total_classes, attended_classes=excluded.attended_classes
    `).run(req.auth.sub, row.semester, row.code, row.name, row.faculty, row.total, row.attended);
    const record = db.prepare("SELECT id, semester, course_code AS code, course_name AS name, faculty, total_classes AS total, attended_classes AS attended FROM attendance WHERE student_id = ? AND semester = ? AND course_code = ?").get(req.auth.sub, row.semester, row.code);
    res.status(201).json({ record });
  } catch (error) {
    throw error;
  }
});

router.delete("/attendance/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid record ID." });
  const result = db.prepare("DELETE FROM attendance WHERE id = ? AND student_id = ?").run(id, req.auth.sub);
  if (!result.changes) return res.status(404).json({ error: "Attendance record not found." });
  res.status(204).end();
});

router.get("/grades", (req, res) => {
  const parsed = semesterSchema.safeParse(req.query.semester ?? 1);
  if (!parsed.success) return res.status(400).json({ error: "Semester must be between 1 and 8." });
  const rows = db.prepare("SELECT id, semester, course_code AS code, course_name AS name, credits, internal_marks AS internal, external_marks AS external, total_marks AS total, grade, points FROM grades WHERE student_id = ? AND semester = ? ORDER BY id").all(req.auth.sub, parsed.data);
  res.json({ records: rows });
});

router.post("/grades", (req, res) => {
  const schema = z.object({
    semester: semesterSchema,
    code: z.string().trim().min(1).max(30),
    name: z.string().trim().min(1).max(120),
    credits: z.coerce.number().int().min(0).max(30).default(0),
    internal: z.coerce.number().min(0).max(100),
    external: z.coerce.number().min(0).max(100),
    total: z.coerce.number().min(0).max(200).optional(),
    grade: z.string().trim().max(5).default(""),
    points: z.coerce.number().min(0).max(10).default(0)
  }).transform(value => ({ ...value, total: value.total ?? value.internal + value.external }));
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid grade record.", details: parsed.error.flatten() });
  const row = parsed.data;
  db.prepare(`
    INSERT INTO grades (student_id, semester, course_code, course_name, credits, internal_marks, external_marks, total_marks, grade, points)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(student_id, semester, course_code) DO UPDATE SET
      course_name=excluded.course_name, credits=excluded.credits,
      internal_marks=excluded.internal_marks, external_marks=excluded.external_marks,
      total_marks=excluded.total_marks, grade=excluded.grade, points=excluded.points
  `).run(req.auth.sub, row.semester, row.code, row.name, row.credits, row.internal, row.external, row.total, row.grade, row.points);
  const record = db.prepare("SELECT id, semester, course_code AS code, course_name AS name, credits, internal_marks AS internal, external_marks AS external, total_marks AS total, grade, points FROM grades WHERE student_id = ? AND semester = ? AND course_code = ?").get(req.auth.sub, row.semester, row.code);
  res.status(201).json({ record });
});

router.delete("/grades/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid record ID." });
  const result = db.prepare("DELETE FROM grades WHERE id = ? AND student_id = ?").run(id, req.auth.sub);
  if (!result.changes) return res.status(404).json({ error: "Grade record not found." });
  res.status(204).end();
});

router.get("/courses", (req, res) => {
  const parsed = semesterSchema.safeParse(req.query.semester ?? 1);
  if (!parsed.success) return res.status(400).json({ error: "Semester must be between 1 and 8." });
  const user = db.prepare("SELECT college FROM users WHERE id = ?").get(req.auth.sub);
  const rows = db.prepare("SELECT id, semester, code, name, credits, faculty FROM courses WHERE college = ? AND semester = ? ORDER BY code").all(user.college, parsed.data);
  res.json({ records: rows });
});

router.post("/courses", requireAdmin, (req, res) => {
  const schema = z.object({
    college: z.enum(["engineering", "medical", "business", "law", "arts"]),
    semester: semesterSchema,
    code: z.string().trim().min(1).max(30),
    name: z.string().trim().min(1).max(120),
    credits: z.coerce.number().int().min(0).max(30),
    faculty: z.string().trim().max(120).default("")
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid course details.", details: parsed.error.flatten() });
  const row = parsed.data;
  try {
    const result = db.prepare("INSERT INTO courses (college, semester, code, name, credits, faculty) VALUES (?, ?, ?, ?, ?, ?)").run(row.college, row.semester, row.code, row.name, row.credits, row.faculty);
    res.status(201).json({ record: { id: Number(result.lastInsertRowid), ...row } });
  } catch (error) {
    if (String(error.code).startsWith("SQLITE_CONSTRAINT")) return res.status(409).json({ error: "That course code already exists in this semester." });
    throw error;
  }
});

router.get("/faculty", (req, res) => {
  const user = db.prepare("SELECT college FROM users WHERE id = ?").get(req.auth.sub);
  const rows = db.prepare("SELECT id, name, qualification, experience, specialization, email, phone, college FROM faculty WHERE college = ? ORDER BY name").all(user.college);
  res.json({ records: rows });
});

router.post("/faculty", requireAdmin, (req, res) => {
  const schema = z.object({
    id: z.string().trim().min(2).max(30).optional(),
    college: z.enum(["engineering", "medical", "business", "law", "arts"]),
    name: z.string().trim().min(1).max(120),
    qualification: z.string().trim().max(120).default(""),
    experience: z.string().trim().max(80).default(""),
    specialization: z.string().trim().max(120).default(""),
    email: z.string().trim().email().or(z.literal("")).default(""),
    phone: z.string().trim().max(40).default("")
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid faculty details.", details: parsed.error.flatten() });
  const row = parsed.data;
  const id = row.id || `FAC-${Date.now().toString(36).toUpperCase()}`;
  try {
    db.prepare("INSERT INTO faculty (id, college, name, qualification, experience, specialization, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id, row.college, row.name, row.qualification, row.experience, row.specialization, row.email, row.phone);
    res.status(201).json({ record: { ...row, id } });
  } catch (error) {
    if (String(error.code).startsWith("SQLITE_CONSTRAINT")) return res.status(409).json({ error: "That faculty ID already exists." });
    throw error;
  }
});

router.get("/students", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT id, first_name AS firstName, last_name AS lastName, college, email, phone, department, year, role, created_at AS createdAt FROM users ORDER BY created_at DESC").all();
  res.json({ records: rows });
});


router.patch("/courses/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid course ID." });
  const schema = z.object({
    college: z.enum(["engineering", "medical", "business", "law", "arts"]),
    semester: semesterSchema,
    code: z.string().trim().min(1).max(30),
    name: z.string().trim().min(1).max(120),
    credits: z.coerce.number().int().min(0).max(30),
    faculty: z.string().trim().max(120).default("")
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid course details.", details: parsed.error.flatten() });
  const row = parsed.data;
  try {
    const result = db.prepare("UPDATE courses SET college = ?, semester = ?, code = ?, name = ?, credits = ?, faculty = ? WHERE id = ?").run(row.college, row.semester, row.code, row.name, row.credits, row.faculty, id);
    if (!result.changes) return res.status(404).json({ error: "Course not found." });
    res.json({ record: { id, ...row } });
  } catch (error) {
    if (String(error.code).startsWith("SQLITE_CONSTRAINT")) return res.status(409).json({ error: "That course code already exists in this semester." });
    throw error;
  }
});

router.delete("/courses/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid course ID." });
  const result = db.prepare("DELETE FROM courses WHERE id = ?").run(id);
  if (!result.changes) return res.status(404).json({ error: "Course not found." });
  res.status(204).end();
});

router.patch("/faculty/:id", requireAdmin, (req, res) => {
  const id = String(req.params.id || "").trim();
  const schema = z.object({
    college: z.enum(["engineering", "medical", "business", "law", "arts"]),
    name: z.string().trim().min(1).max(120),
    qualification: z.string().trim().max(120).default(""),
    experience: z.string().trim().max(80).default(""),
    specialization: z.string().trim().max(120).default(""),
    email: z.string().trim().email().or(z.literal("")).default(""),
    phone: z.string().trim().max(40).default("")
  });
  const parsed = schema.safeParse(req.body);
  if (!id || !parsed.success) return res.status(400).json({ error: "Invalid faculty details.", details: parsed.success ? undefined : parsed.error.flatten() });
  const row = parsed.data;
  const result = db.prepare("UPDATE faculty SET college = ?, name = ?, qualification = ?, experience = ?, specialization = ?, email = ?, phone = ? WHERE id = ?").run(row.college, row.name, row.qualification, row.experience, row.specialization, row.email, row.phone, id);
  if (!result.changes) return res.status(404).json({ error: "Faculty member not found." });
  res.json({ record: { ...row, id } });
});

router.delete("/faculty/:id", requireAdmin, (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "Invalid faculty ID." });
  const result = db.prepare("DELETE FROM faculty WHERE id = ?").run(id);
  if (!result.changes) return res.status(404).json({ error: "Faculty member not found." });
  res.status(204).end();
});

module.exports = router;
