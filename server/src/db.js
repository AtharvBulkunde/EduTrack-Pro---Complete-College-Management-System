const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
require("dotenv").config();

const configuredPath = process.env.DATABASE_FILE || "./data/edutrack.sqlite";
const dbPath = path.isAbsolute(configuredPath)
  ? configuredPath
  : path.resolve(__dirname, "..", configuredPath);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    college TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    dob TEXT NOT NULL DEFAULT '',
    blood_group TEXT NOT NULL DEFAULT 'O+',
    department TEXT NOT NULL DEFAULT 'Computer Science',
    year INTEGER NOT NULL DEFAULT 1 CHECK (year BETWEEN 1 AND 6),
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS faculty (
    id TEXT PRIMARY KEY,
    college TEXT NOT NULL,
    name TEXT NOT NULL,
    qualification TEXT NOT NULL DEFAULT '',
    experience TEXT NOT NULL DEFAULT '',
    specialization TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    college TEXT NOT NULL,
    semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    credits INTEGER NOT NULL DEFAULT 0,
    faculty TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(college, semester, code)
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
    course_code TEXT NOT NULL,
    course_name TEXT NOT NULL,
    faculty TEXT NOT NULL DEFAULT '',
    total_classes INTEGER NOT NULL CHECK (total_classes >= 0),
    attended_classes INTEGER NOT NULL CHECK (attended_classes >= 0 AND attended_classes <= total_classes),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, semester, course_code)
  );

  CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
    course_code TEXT NOT NULL,
    course_name TEXT NOT NULL,
    credits INTEGER NOT NULL DEFAULT 0,
    internal_marks REAL NOT NULL DEFAULT 0,
    external_marks REAL NOT NULL DEFAULT 0,
    total_marks REAL NOT NULL DEFAULT 0,
    grade TEXT NOT NULL DEFAULT '',
    points REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, semester, course_code)
  );

  CREATE INDEX IF NOT EXISTS idx_attendance_student_semester ON attendance(student_id, semester);
  CREATE INDEX IF NOT EXISTS idx_grades_student_semester ON grades(student_id, semester);
  CREATE INDEX IF NOT EXISTS idx_courses_college_semester ON courses(college, semester);
  CREATE INDEX IF NOT EXISTS idx_faculty_college ON faculty(college);
`);

module.exports = db;
