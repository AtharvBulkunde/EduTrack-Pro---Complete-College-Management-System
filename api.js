/* EduTrack Pro API client.
 * Include this file before the inline script in index.html when migrating the page
 * to server-backed records. It provides small typed-by-convention wrappers and
 * stores only a short-lived access token; never store passwords in localStorage.
 */
(() => {
  const API_BASE = (window.EDUTRACK_API_BASE || "http://localhost:4000/api").replace(/\/$/, "");
  const TOKEN_KEY = "edutrack_access_token";

  async function request(path, options = {}) {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const headers = { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }

  window.EduTrackAPI = {
    baseUrl: API_BASE,
    setToken(token) { if (token) sessionStorage.setItem(TOKEN_KEY, token); else sessionStorage.removeItem(TOKEN_KEY); },
    getToken() { return sessionStorage.getItem(TOKEN_KEY); },
    health: () => request("/health"),
    signup: body => request("/auth/signup", { method: "POST", body: JSON.stringify(body) }),
    login: body => request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
    me: () => request("/auth/me"),
    updateProfile: body => request("/auth/me", { method: "PATCH", body: JSON.stringify(body) }),
    dashboard: () => request("/dashboard"),
    attendance: semester => request(`/attendance?semester=${encodeURIComponent(semester || 1)}`),
    saveAttendance: body => request("/attendance", { method: "POST", body: JSON.stringify(body) }),
    deleteAttendance: id => request(`/attendance/${encodeURIComponent(id)}`, { method: "DELETE" }),
    grades: semester => request(`/grades?semester=${encodeURIComponent(semester || 1)}`),
    saveGrade: body => request("/grades", { method: "POST", body: JSON.stringify(body) }),
    deleteGrade: id => request(`/grades/${encodeURIComponent(id)}`, { method: "DELETE" }),
    courses: semester => request(`/courses?semester=${encodeURIComponent(semester || 1)}`),
    addCourse: body => request("/courses", { method: "POST", body: JSON.stringify(body) }),
    faculty: () => request("/faculty"),
    addFaculty: body => request("/faculty", { method: "POST", body: JSON.stringify(body) }),
    students: () => request("/students")
  };
})();
