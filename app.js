(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const state = { user: null, view: "dashboard", modalKind: null, editId: null, toastTimer: null };
  const collegeNames = { engineering: "Engineering", medical: "Medical", business: "Business", law: "Law", arts: "Arts" };
  const titleNames = { dashboard: "Dashboard", attendance: "Attendance", grades: "Grades & results", courses: "Courses", faculty: "Faculty", students: "Students", profile: "My profile" };

  function notify(message, isError = false) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.toggle("error", isError);
    toast.classList.add("visible");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove("visible"), 3200);
  }
  function message(text, error = false) {
    $("auth-message").textContent = text;
    $("auth-message").style.color = error ? "var(--danger)" : "var(--green)";
  }
  function initials(user) {
    return ((user?.firstName || "E")[0] + (user?.lastName || "T")[0]).toUpperCase();
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  function setBusy(form, busy) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    button.disabled = busy;
    button.style.opacity = busy ? ".65" : "1";
  }
  async function runForm(form, action) {
    setBusy(form, true);
    try { await action(); }
    catch (error) { if (form.id === "login-form" || form.id === "signup-form") message(error.message || "Something went wrong.", true); else notify(error.message || "Something went wrong.", true); }
    finally { setBusy(form, false); }
  }

  function showAuth(tab = "login") {
    $("app-shell").classList.add("hidden");
    $("auth-screen").classList.remove("hidden");
    document.querySelectorAll("[data-auth-tab]").forEach(button => button.classList.toggle("active", button.dataset.authTab === tab));
    $("login-form").classList.toggle("hidden", tab !== "login");
    $("signup-form").classList.toggle("hidden", tab !== "signup");
    $("auth-title").textContent = tab === "login" ? "Sign in to your campus" : "Create your student account";
    $("auth-subtitle").textContent = tab === "login" ? "Use your student ID to continue to your workspace." : "Your new account will be saved securely in the database.";
    message("");
  }
  function showApp(user) {
    state.user = user;
    $("auth-screen").classList.add("hidden");
    $("app-shell").classList.remove("hidden");
    $("user-avatar").textContent = initials(user);
    $("user-short-name").textContent = user.firstName + " " + user.lastName;
    $("user-role").textContent = user.role === "admin" ? "Administrator" : "Student account";
    $("welcome-name").textContent = user.firstName;
    $("today-date").textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date());
    $("footer-year").textContent = new Date().getFullYear();
    document.querySelectorAll(".admin-only").forEach(el => el.classList.toggle("hidden", user.role !== "admin"));
    fillProfile(user);
    navigate("dashboard");
    refreshDashboard().catch(error => notify(error.message, true));
  }
  function navigate(view) {
    if (!titleNames[view]) view = "dashboard";
    if (view === "students" && state.user?.role !== "admin") view = "dashboard";
    state.view = view;
    document.querySelectorAll(".view").forEach(el => el.classList.toggle("active", el.id === "view-" + view));
    document.querySelectorAll(".nav-item[data-view]").forEach(el => el.classList.toggle("active", el.dataset.view === view));
    $("page-breadcrumb").textContent = titleNames[view];
    $("sidebar").classList.remove("open");
    const loader = { dashboard: refreshDashboard, attendance: loadAttendance, grades: loadGrades, courses: loadCourses, faculty: loadFaculty, students: loadStudents, profile: () => fillProfile(state.user) };
    Promise.resolve(loader[view]?.()).catch(error => notify(error.message || "Could not load section.", true));
  }
  function fillProfile(user) {
    if (!user) return;
    $("profile-big-avatar").textContent = initials(user);
    $("profile-full-name").textContent = user.firstName + " " + user.lastName;
    $("profile-email-text").textContent = user.email;
    $("profile-role-pill").textContent = user.role === "admin" ? "Administrator" : "Student";
    $("profile-id").textContent = user.id;
    $("profile-college").textContent = collegeNames[user.college] || user.college;
    $("profile-role").textContent = user.role;
    $("profile-first").value = user.firstName || "";
    $("profile-last").value = user.lastName || "";
    $("profile-email").value = user.email || "";
    $("profile-phone").value = user.phone || "";
    $("profile-dob").value = user.dob || "";
    $("profile-department").value = user.department || "";
    $("profile-year").value = String(user.year || 1);
    $("profile-blood").value = user.bloodGroup || "O+";
  }
  async function refreshDashboard() {
    const stats = await window.EduTrackAPI.dashboard();
    $("metric-attendance").textContent = stats.attendancePercent;
    $("metric-courses").textContent = stats.courseCount;
    $("metric-grades").textContent = stats.gradeCount;
    $("metric-records").textContent = stats.attendanceRecords;
    $("attendance-bar").style.width = stats.attendancePercent + "%";
    $("courses-bar").style.width = Math.min(100, stats.courseCount * 10) + "%";
    $("grades-bar").style.width = Math.min(100, stats.gradeCount * 8) + "%";
    $("records-bar").style.width = Math.min(100, stats.attendanceRecords * 10) + "%";
  }
  function selectedSemester(id) { return Number($(id).value || 1); }
  function showEmpty(id, isEmpty) { $(id).classList.toggle("hidden", !isEmpty); }

  async function loadAttendance() {
    const data = (await window.EduTrackAPI.attendance(selectedSemester("attendance-semester"))).records || [];
    $("attendance-summary").textContent = data.length + (data.length === 1 ? " subject recorded" : " subjects recorded");
    $("attendance-body").innerHTML = data.map(row => {
      const percent = row.total ? Math.round(row.attended / row.total * 100) : 0;
      return `<tr><td class="subject-cell"><b>${escapeHtml(row.name)}</b><small>${escapeHtml(row.code)}</small></td><td>${escapeHtml(row.faculty || "—")}</td><td>${row.total}</td><td>${row.attended}</td><td><span class="percent-pill ${percent < 75 ? "low" : ""}">${percent}%</span></td><td><div class="row-actions"><button class="mini-btn" data-edit="attendance" data-record="${row.id}">Edit</button><button class="mini-btn danger" data-delete="attendance" data-record="${row.id}">Delete</button></div></td></tr>`;
    }).join("");
    showEmpty("attendance-empty", data.length === 0);
    $("attendance-body")._records = data;
  }
  async function loadGrades() {
    const data = (await window.EduTrackAPI.grades(selectedSemester("grades-semester"))).records || [];
    $("grades-summary").textContent = data.length + (data.length === 1 ? " grade record" : " grade records");
    $("grades-body").innerHTML = data.map(row => `<tr><td class="subject-cell"><b>${escapeHtml(row.name)}</b><small>${escapeHtml(row.code)}</small></td><td>${row.credits}</td><td>${row.internal}</td><td>${row.external}</td><td><b>${row.total}</b></td><td><span class="grade-pill">${escapeHtml(row.grade || "—")}</span></td><td>${row.points}</td><td><div class="row-actions"><button class="mini-btn" data-edit="grades" data-record="${row.id}">Edit</button><button class="mini-btn danger" data-delete="grades" data-record="${row.id}">Delete</button></div></td></tr>`).join("");
    showEmpty("grades-empty", data.length === 0);
    $("grades-body")._records = data;
  }
  async function loadCourses() {
    const data = (await window.EduTrackAPI.courses(selectedSemester("courses-semester"))).records || [];
    $("courses-summary").textContent = data.length + " course" + (data.length === 1 ? "" : "s");
    $("courses-grid").innerHTML = data.map(row => `<article class="course-card"><div class="course-card-top"><span class="code-pill">${escapeHtml(row.code)}</span><span class="credit-pill">${row.credits} credits</span></div><h3>${escapeHtml(row.name)}</h3><p>Semester ${row.semester}</p><div class="course-card-footer"><span>Faculty</span><b>${escapeHtml(row.faculty || "Not assigned")}</b></div>${state.user.role === "admin" ? `<div class="row-actions" style="margin-top:12px"><button class="mini-btn" data-edit="courses" data-record="${row.id}">Edit</button><button class="mini-btn danger" data-delete="courses" data-record="${row.id}">Delete</button></div>` : ""}</article>`).join("");
    if (!data.length) $("courses-grid").innerHTML = '<div class="panel empty-state" style="grid-column:1/-1"><div>▧</div><h3>No courses for this semester</h3><p>An administrator can add courses for your college.</p></div>';
    $("courses-grid")._records = data;
  }
  async function loadFaculty() {
    const data = (await window.EduTrackAPI.faculty()).records || [];
    $("faculty-grid").innerHTML = data.map(row => `<article class="faculty-card"><div class="faculty-avatar">${escapeHtml((row.name || "F").split(/\s+/).map(part => part[0]).slice(0,2).join("").toUpperCase())}</div><div><h3>${escapeHtml(row.name)}</h3><p>${escapeHtml(row.qualification || "Faculty member")}</p><p class="specialty">${escapeHtml(row.specialization || "General faculty")}</p><p>${escapeHtml(row.experience || "Experience not listed")}</p><div class="faculty-contact"><p>${escapeHtml(row.email || "Email not listed")}</p><p>${escapeHtml(row.phone || "")}</p></div>${state.user.role === "admin" ? `<div class="row-actions" style="margin-top:12px"><button class="mini-btn" data-edit="faculty" data-record="${escapeHtml(row.id)}">Edit</button><button class="mini-btn danger" data-delete="faculty" data-record="${escapeHtml(row.id)}">Delete</button></div>` : ""}</div></article>`).join("");
    if (!data.length) $("faculty-grid").innerHTML = '<div class="panel empty-state" style="grid-column:1/-1"><div>♙</div><h3>No faculty added yet</h3><p>An administrator can add members to this directory.</p></div>';
    $("faculty-grid")._records = data;
  }
  async function loadStudents() {
    if (state.user.role !== "admin") return;
    const data = (await window.EduTrackAPI.students()).records || [];
    $("students-body").innerHTML = data.map(row => `<tr><td class="subject-cell"><b>${escapeHtml(row.firstName)} ${escapeHtml(row.lastName)}</b><small>${escapeHtml(row.department || "")}</small></td><td>${escapeHtml(row.id)}</td><td>${escapeHtml(collegeNames[row.college] || row.college)}</td><td>${escapeHtml(row.email)}</td><td>${row.year}</td><td><span class="role-pill">${escapeHtml(row.role)}</span></td></tr>`).join("");
    showEmpty("students-empty", data.length === 0);
  }

  const input = (name, label, type = "text", value = "", attrs = "") => `<label>${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${attrs}></label>`;
  const selectInput = (name, label, options, value) => `<label>${label}<select name="${name}">${options.map(opt => `<option value="${escapeHtml(opt[0])}" ${String(value) === String(opt[0]) ? "selected" : ""}>${escapeHtml(opt[1])}</option>`).join("")}</select></label>`;
  function openModal(kind, record = null) {
    state.modalKind = kind;
    state.editId = record?.id ?? null;
    const editing = Boolean(record);
    const config = {
      attendance: { title: editing ? "Edit attendance record" : "Add attendance record", description: "Enter attendance for one subject.", fields: [
        input("code","Course code","text",record?.code || "","required maxlength=\"30\""),
        input("name","Course name","text",record?.name || "","required maxlength=\"120\""),
        input("faculty","Faculty","text",record?.faculty || "","maxlength=\"120\""),
        `<div class="form-row">${input("total","Classes held","number",record?.total ?? "","required min=\"0\" max=\"10000\"")}${input("attended","Classes attended","number",record?.attended ?? "","required min=\"0\" max=\"10000\"")}</div>`,
        selectInput("semester","Semester",Array.from({length:8},(_,i)=>[String(i+1),"Semester "+(i+1)]),record?.semester || selectedSemester("attendance-semester"))
      ]},
      grades: { title: editing ? "Edit grade record" : "Add grade record", description: "Add academic results for a subject.", fields: [
        input("code","Course code","text",record?.code || "","required maxlength=\"30\""),
        input("name","Course name","text",record?.name || "","required maxlength=\"120\""),
        `<div class="form-row">${input("credits","Credits","number",record?.credits ?? 0,"required min=\"0\" max=\"30\"")}${selectInput("semester","Semester",Array.from({length:8},(_,i)=>[String(i+1),"Semester "+(i+1)]),record?.semester || selectedSemester("grades-semester"))}</div>`,
        `<div class="form-row">${input("internal","Internal marks","number",record?.internal ?? 0,"required min=\"0\" max=\"100\" step=\"0.5\"")}${input("external","External marks","number",record?.external ?? 0,"required min=\"0\" max=\"100\" step=\"0.5\"")}</div>`,
        `<div class="form-row">${input("grade","Grade","text",record?.grade || "","maxlength=\"5\"")}${input("points","Grade points","number",record?.points ?? 0,"min=\"0\" max=\"10\" step=\"0.1\"")}</div>`
      ]},
      courses: { title: editing ? "Edit course" : "Add course", description: "Publish a course for a selected college.", fields: [
        selectInput("college","College",Object.entries(collegeNames),record?.college || state.user.college),
        selectInput("semester","Semester",Array.from({length:8},(_,i)=>[String(i+1),"Semester "+(i+1)]),record?.semester || selectedSemester("courses-semester")),
        input("code","Course code","text",record?.code || "","required maxlength=\"30\""),
        input("name","Course name","text",record?.name || "","required maxlength=\"120\""),
        input("credits","Credits","number",record?.credits ?? 3,"required min=\"0\" max=\"30\""),
        input("faculty","Faculty name","text",record?.faculty || "","maxlength=\"120\"")
      ]},
      faculty: { title: editing ? "Edit faculty" : "Add faculty", description: "Add a faculty profile to a college directory.", fields: [
        selectInput("college","College",Object.entries(collegeNames),record?.college || state.user.college),
        input("name","Full name","text",record?.name || "","required maxlength=\"120\""),
        input("qualification","Qualification","text",record?.qualification || "","maxlength=\"120\""),
        input("specialization","Specialization","text",record?.specialization || "","maxlength=\"120\""),
        input("experience","Experience","text",record?.experience || "","maxlength=\"80\""),
        input("email","Email","email",record?.email || ""),
        input("phone","Phone","tel",record?.phone || "","maxlength=\"40\"")
      ]}
    };
    const cfg = config[kind];
    if (!cfg) return;
    $("modal-title").textContent = cfg.title;
    $("modal-description").textContent = cfg.description;
    $("modal-fields").innerHTML = cfg.fields.join("");
    $("record-modal").classList.remove("hidden");
  }
  function closeModal() { $("record-modal").classList.add("hidden"); $("record-form").reset(); state.modalKind = null; state.editId = null; }

  $("login-form").addEventListener("submit", event => {
    event.preventDefault();
    runForm(event.currentTarget, async () => {
      const result = await window.EduTrackAPI.login({ id: $("login-id").value.trim(), college: $("login-college").value, password: $("login-password").value });
      window.EduTrackAPI.setToken(result.token);
      message("");
      showApp(result.user);
    });
  });
  $("signup-form").addEventListener("submit", event => {
    event.preventDefault();
    runForm(event.currentTarget, async () => {
      const result = await window.EduTrackAPI.signup({ firstName: $("signup-first").value.trim(), lastName: $("signup-last").value.trim(), college: $("signup-college").value, email: $("signup-email").value.trim(), password: $("signup-password").value });
      window.EduTrackAPI.setToken(result.token);
      showApp(result.user);
      notify("Account created and saved successfully.");
    });
  });
  document.querySelectorAll("[data-auth-tab]").forEach(button => button.addEventListener("click", () => showAuth(button.dataset.authTab)));
  document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.view)));
  document.querySelectorAll("[data-jump]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.jump)));
  $("logout-btn").addEventListener("click", () => { window.EduTrackAPI.setToken(null); state.user = null; showAuth("login"); notify("You have signed out."); });
  $("mobile-menu").addEventListener("click", () => $("sidebar").classList.toggle("open"));
  $("new-attendance").addEventListener("click", () => openModal("attendance"));
  $("new-grade").addEventListener("click", () => openModal("grades"));
  $("new-course").addEventListener("click", () => openModal("courses"));
  $("new-faculty").addEventListener("click", () => openModal("faculty"));
  $("close-modal").addEventListener("click", closeModal);
  $("cancel-modal").addEventListener("click", closeModal);
  $("record-modal").addEventListener("click", event => { if (event.target === $("record-modal")) closeModal(); });
  $("attendance-semester").addEventListener("change", () => loadAttendance().catch(e => notify(e.message,true)));
  $("grades-semester").addEventListener("change", () => loadGrades().catch(e => notify(e.message,true)));
  $("courses-semester").addEventListener("change", () => loadCourses().catch(e => notify(e.message,true)));

  document.addEventListener("click", event => {
    const edit = event.target.closest("[data-edit]");
    const del = event.target.closest("[data-delete]");
    if (edit) {
      const kind = edit.dataset.edit;
      const records = kind === "attendance" ? ($("attendance-body")._records || []) : kind === "grades" ? ($("grades-body")._records || []) : kind === "courses" ? ($("courses-grid")._records || []) : ($("faculty-grid")._records || []);
      const record = records.find(item => String(item.id) === String(edit.dataset.record));
      if (record) openModal(kind, record);
    }
    if (del) {
      const kind = del.dataset.delete;
      const id = del.dataset.record;
      if (!confirm("Delete this record from the database? This cannot be undone.")) return;
      runForm($("record-form"), async () => {
        const method = kind === "attendance" ? window.EduTrackAPI.deleteAttendance : kind === "grades" ? window.EduTrackAPI.deleteGrade : kind === "courses" ? window.EduTrackAPI.deleteCourse : window.EduTrackAPI.deleteFaculty;
        await method(id);
        notify("Record deleted.");
        await ({ attendance: loadAttendance, grades: loadGrades, courses: loadCourses, faculty: loadFaculty })[kind]();
        refreshDashboard().catch(() => {});
      });
    }
  });

  $("record-form").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget;
    runForm(form, async () => {
      const values = Object.fromEntries(new FormData(form).entries());
      const kind = state.modalKind;
      if (kind === "attendance") {
        values.semester = Number(values.semester); values.total = Number(values.total); values.attended = Number(values.attended);
        if (values.attended > values.total) throw new Error("Classes attended cannot exceed classes held.");
        await window.EduTrackAPI.saveAttendance(values);
      } else if (kind === "grades") {
        values.semester = Number(values.semester); values.credits = Number(values.credits); values.internal = Number(values.internal); values.external = Number(values.external); values.total = values.internal + values.external; values.points = Number(values.points || 0);
        await window.EduTrackAPI.saveGrade(values);
      } else if (kind === "courses") {
        values.semester = Number(values.semester); values.credits = Number(values.credits);
        if (state.editId) await window.EduTrackAPI.updateCourse(state.editId, values); else await window.EduTrackAPI.addCourse(values);
      } else if (kind === "faculty") {
        if (state.editId) await window.EduTrackAPI.updateFaculty(state.editId, values); else await window.EduTrackAPI.addFaculty(values);
      }
      closeModal();
      notify("Changes saved to the database.");
      await ({ attendance: loadAttendance, grades: loadGrades, courses: loadCourses, faculty: loadFaculty })[kind]();
      await refreshDashboard();
    });
  });

  $("profile-form").addEventListener("submit", event => {
    event.preventDefault();
    runForm(event.currentTarget, async () => {
      const result = await window.EduTrackAPI.updateProfile({
        firstName: $("profile-first").value.trim(), lastName: $("profile-last").value.trim(),
        phone: $("profile-phone").value.trim(), dob: $("profile-dob").value,
        bloodGroup: $("profile-blood").value, department: $("profile-department").value.trim(), year: Number($("profile-year").value)
      });
      showApp(result.user);
      notify("Profile updated.");
    });
  });

  (async function boot() {
    try {
      await window.EduTrackAPI.health();
      if (window.EduTrackAPI.getToken()) {
        try { const result = await window.EduTrackAPI.me(); showApp(result.user); return; }
        catch { window.EduTrackAPI.setToken(null); }
      }
      showAuth("login");
    } catch {
      showAuth("login");
      message("The API is not reachable. Start the backend using the steps in FULL_STACK_SETUP.md.", true);
    }
  })();
})();
