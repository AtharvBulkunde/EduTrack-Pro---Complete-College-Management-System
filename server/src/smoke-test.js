const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const serverDir = path.resolve(__dirname, "..");
const dbPath = path.join(serverDir, "data", "smoke-test.sqlite");
const port = 4317;
const base = `http://127.0.0.1:${port}/api`;
const jwtSecret = "smoke-test-secret-with-more-than-thirty-two-characters";
let server;

for (const suffix of ["", "-shm", "-wal"]) fs.rmSync(dbPath + suffix, { force: true });

async function api(route, { method = "GET", token, body } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  return { response, data };
}

function status(result, expected, label) {
  assert.equal(result.response.status, expected, `${label}: expected HTTP ${expected}, got ${result.response.status}; body=${JSON.stringify(result.data)}`);
}

async function waitForServer(child) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw new Error(`API process exited before ready (code ${child.exitCode}).`);
    try {
      const response = await fetch(base + "/health");
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("API did not become ready within 8 seconds.");
}

async function main() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  server = spawn(process.execPath, ["src/server.js"], {
    cwd: serverDir,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      JWT_SECRET: jwtSecret,
      CLIENT_ORIGIN: "http://localhost:5500",
      DATABASE_FILE: dbPath
    },
    stdio: "ignore"
  });

  try {
    await waitForServer(server);
    const health = await api("/health");
    status(health, 200, "health check");
    assert.equal(health.data.status, "ok");

    // Profile routes must reject unauthenticated requests.
    status(await api("/auth/me"), 401, "unauthenticated profile request");

    const signup = await api("/auth/signup", {
      method: "POST",
      body: {
        firstName: "Smoke",
        lastName: "Student",
        college: "engineering",
        email: "smoke.student@example.test",
        password: "StudentSmokePass123",
        department: "Computer Engineering",
        year: 2
      }
    });
    status(signup, 201, "student signup");
    assert.ok(signup.data.user.id);
    const studentToken = signup.data.token;

    const login = await api("/auth/login", {
      method: "POST",
      body: { id: signup.data.user.id, college: "engineering", password: "StudentSmokePass123" }
    });
    status(login, 200, "student login");
    const token = login.data.token;
    status(await api("/dashboard", { token }), 200, "student dashboard");

    const profile = await api("/auth/me", { token });
    status(profile, 200, "authenticated profile");
    assert.equal(profile.data.user.email, "smoke.student@example.test");

    const patchedProfile = await api("/auth/me", {
      method: "PATCH", token, body: { phone: "9999999999", department: "Computer Engineering", year: 3 }
    });
    status(patchedProfile, 200, "profile update");
    assert.equal(patchedProfile.data.user.year, "3");

    const forbiddenCourse = await api("/courses", {
      method: "POST", token, body: { college: "engineering", semester: 1, code: "NOPE", name: "Not Allowed", credits: 3, faculty: "" }
    });
    status(forbiddenCourse, 403, "student cannot create courses");

    const attendanceCreate = await api("/attendance", {
      method: "POST", token,
      body: { semester: 1, code: "CS101", name: "Data Structures", faculty: "Dr Test", total: 10, attended: 9 }
    });
    status(attendanceCreate, 201, "attendance create");
    const attendanceId = attendanceCreate.data.record.id;
    const attendanceList = await api("/attendance?semester=1", { token });
    status(attendanceList, 200, "attendance read");
    assert.equal(attendanceList.data.records.length, 1);
    const attendancePatch = await api(`/attendance/${attendanceId}`, {
      method: "PATCH", token,
      body: { semester: 1, code: "CS101", name: "Data Structures", faculty: "Dr Test", total: 10, attended: 8 }
    });
    status(attendancePatch, 200, "attendance update");
    assert.equal(attendancePatch.data.record.attended, 8);
    status(await api(`/attendance/${attendanceId}`, { method: "DELETE", token }), 204, "attendance delete");

    const gradeCreate = await api("/grades", {
      method: "POST", token,
      body: { semester: 1, code: "CS101", name: "Data Structures", credits: 4, internal: 42, external: 45, grade: "A", points: 9 }
    });
    status(gradeCreate, 201, "grade create");
    const gradeId = gradeCreate.data.record.id;
    const gradeList = await api("/grades?semester=1", { token });
    status(gradeList, 200, "grade read");
    assert.equal(gradeList.data.records.length, 1);
    const gradePatch = await api(`/grades/${gradeId}`, {
      method: "PATCH", token,
      body: { semester: 1, code: "CS101", name: "Data Structures", credits: 4, internal: 44, external: 45, grade: "A+", points: 10 }
    });
    status(gradePatch, 200, "grade update");
    assert.equal(gradePatch.data.record.total, 89);
    status(await api(`/grades/${gradeId}`, { method: "DELETE", token }), 204, "grade delete");

    // Seed a test administrator directly in the disposable test database.
    const testDb = new Database(dbPath);
    const adminPassword = "AdminSmokePass123";
    const adminHash = await bcrypt.hash(adminPassword, 4);
    testDb.prepare(`INSERT INTO users (id, first_name, last_name, college, email, password_hash, department, year, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'admin')`).run(
      "ENG2026999", "Smoke", "Admin", "engineering", "smoke.admin@example.test", adminHash, "Administration", 1
    );
    testDb.close();

    const adminLogin = await api("/auth/login", {
      method: "POST",
      body: { id: "ENG2026999", college: "engineering", password: adminPassword }
    });
    status(adminLogin, 200, "admin login");
    const adminToken = adminLogin.data.token;

    const courseCreate = await api("/courses", {
      method: "POST", token: adminToken,
      body: { college: "engineering", semester: 1, code: "TEST100", name: "Test Course", credits: 3, faculty: "Test Faculty" }
    });
    status(courseCreate, 201, "admin course create");
    const courseId = courseCreate.data.record.id;
    const coursePatch = await api(`/courses/${courseId}`, {
      method: "PATCH", token: adminToken,
      body: { college: "engineering", semester: 1, code: "TEST101", name: "Updated Course", credits: 4, faculty: "Test Faculty" }
    });
    status(coursePatch, 200, "admin course update");
    status(await api(`/courses/${courseId}`, { method: "DELETE", token: adminToken }), 204, "admin course delete");

    const facultyCreate = await api("/faculty", {
      method: "POST", token: adminToken,
      body: { id: "FAC-SMOKE-001", college: "engineering", name: "Test Faculty", qualification: "MSc", experience: "4 years", specialization: "Testing", email: "faculty.smoke@example.test", phone: "9999999998" }
    });
    status(facultyCreate, 201, "admin faculty create");
    const facultyPatch = await api("/faculty/FAC-SMOKE-001", {
      method: "PATCH", token: adminToken,
      body: { college: "engineering", name: "Updated Faculty", qualification: "MSc", experience: "5 years", specialization: "Testing", email: "faculty.smoke@example.test", phone: "9999999998" }
    });
    status(facultyPatch, 200, "admin faculty update");
    status(await api("/faculty/FAC-SMOKE-001", { method: "DELETE", token: adminToken }), 204, "admin faculty delete");

    const students = await api("/students", { token: adminToken });
    status(students, 200, "admin student directory");
    assert.ok(students.data.records.some(row => row.id === signup.data.user.id));

    console.log("EduTrack Pro API smoke test passed: auth, profile, dashboard, attendance, grades, admin course/faculty CRUD, and student directory.");
  } finally {
    if (server && server.exitCode === null) {
      server.kill("SIGTERM");
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 1500);
        server.once("exit", () => { clearTimeout(timer); resolve(); });
      });
    }
    for (const suffix of ["", "-shm", "-wal"]) fs.rmSync(dbPath + suffix, { force: true });
  }
}

main().catch(error => {
  console.error("EduTrack Pro API smoke test failed:", error);
  process.exitCode = 1;
});
