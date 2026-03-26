const state = {
  me: null,
  tests: [],
  activeTest: null,
  mode: "practice",
  currentIndex: 0,
  answers: [],
  marked: new Set(),
  bookmarked: new Set(),
  notes: {},
  timer: 0,
  timerHandle: null,
  paused: false,
  startedAt: null,
  language: "en",
  theme: "dark",
  sound: true,
  volume: 0.25
};

const I18N = {
  en: {
    appTitle: "NEET Biology PYQ",
    appSubtitle: "Premium test practice platform",
    badgeBio: "Biology only",
    badgeModes: "Practice / Exam / Hard",
    badgePlain: "Secure MongoDB storage",
    loginHeroTitle: "Welcome back",
    loginHeroText: "Login to continue your NEET Biology practice.",
    signupHeroTitle: "Create your account",
    signupHeroText: "Sign up first, then use login for the next 3 days without signing in again.",
    loginTitle: "Login",
    signupTitle: "Sign up",
    loginBadge: "Already have an account",
    signupBadge: "Create a new account",
    loginBtn: "Login",
    createAccount: "Create account",
    noAccount: "New user?",
    haveAccount: "Already have an account?",
    signupLink: "Sign up here",
    loginLink: "Login here",
    username: "Username",
    password: "Password",
    name: "Name",
    forgotTitle: "Forgot password",
    uploadHelp: "Upload profile picture from device storage.",
    dashTitle: "Serious NEET Biology simulation",
    dashText: "Hints appear only in Practice Mode. Exam Mode and Hard Mode stay strict.",
    testsTitle: "Tests",
    analyticsTitle: "Analytics",
    suggestionsTitle: "Suggestions",
    weeklyTopper: "Weekly topper",
    searchUsers: "User search",
    profileTitle: "Profile",
    profileSubtitle: "Edit picture, password, privacy, and contacts",
    refresh: "Refresh",
    dark: "Dark",
    light: "Light",
    soundOn: "Sound On",
    soundOff: "Sound Off",
    english: "English",
    hinglish: "Hinglish",
    save: "Save",
    logout: "Logout",
    preview: "Preview",
    open: "Open",
    start: "Start",
    report: "Report",
    results: "Results",
    search: "Search"
  },
  hinglish: {
    appTitle: "NEET Biology PYQ",
    appSubtitle: "Premium test practice platform",
    badgeBio: "Sirf Biology",
    badgeModes: "Practice / Exam / Hard",
    badgePlain: "Secure MongoDB storage",
    loginHeroTitle: "Wapas swagat hai",
    loginHeroText: "Apni NEET Biology practice continue karne ke liye login karo.",
    signupHeroTitle: "Apna account banao",
    signupHeroText: "Pehle signup karo, phir 3 din tak login ki zarurat nahi padegi.",
    loginTitle: "Login",
    signupTitle: "Sign up",
    loginBadge: "Pehle se account hai",
    signupBadge: "Naya account banao",
    loginBtn: "Login",
    createAccount: "Account banao",
    noAccount: "Naya user?",
    haveAccount: "Pehle se account hai?",
    signupLink: "Yahan signup karo",
    loginLink: "Yahan login karo",
    username: "Username",
    password: "Password",
    name: "Naam",
    forgotTitle: "Password bhool gaye",
    uploadHelp: "Profile picture device storage se upload karo.",
    dashTitle: "Serious NEET Biology simulation",
    dashText: "Hints sirf Practice Mode mein dikhengi. Exam Mode aur Hard Mode strict rahenge.",
    testsTitle: "Tests",
    analyticsTitle: "Analytics",
    suggestionsTitle: "Suggestions",
    weeklyTopper: "Weekly topper",
    searchUsers: "User search",
    profileTitle: "Profile",
    profileSubtitle: "Picture, password, privacy aur contacts badlo",
    refresh: "Refresh",
    dark: "Dark",
    light: "Light",
    soundOn: "Sound On",
    soundOff: "Sound Off",
    english: "English",
    hinglish: "Hinglish",
    save: "Save",
    logout: "Logout",
    preview: "Preview",
    open: "Open",
    start: "Start",
    report: "Report",
    results: "Results",
    search: "Search"
  }
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function api(url, opts = {}) {
  return fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...opts
  }).then(async (r) => {
    const txt = await r.text();
    let data = {};
    try { data = txt ? JSON.parse(txt) : {}; } catch { data = { raw: txt }; }
    if (!r.ok) throw data;
    return data;
  });
}

function sfx(type = "click") {
  if (!state.sound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type === "bad" ? "square" : "sine";
    osc.frequency.value = type === "bad" ? 140 : 440;
    gain.gain.value = state.volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch {}
}

function openModal(html) {
  const modal = $("#modal");
  if (!modal) return;
  $("#modalPanel").innerHTML = html;
  modal.classList.add("show");
}
function closeModal() { const modal = $("#modal"); if (modal) modal.classList.remove("show"); }
document.addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });

function t(key) { return I18N[state.language]?.[key] || I18N.en[key] || key; }

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => el.textContent = t(el.getAttribute("data-i18n")));
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => el.placeholder = t(el.getAttribute("data-i18n-placeholder")));
  if ($("#themeBtn")) $("#themeBtn").textContent = state.theme === "dark" ? t("dark") : t("light");
  if ($("#langBtn")) $("#langBtn").textContent = state.language === "en" ? t("english") : t("hinglish");
  if ($("#soundBtn")) $("#soundBtn").textContent = state.sound ? t("soundOn") : t("soundOff");
}
function setTheme(mode) { document.body.classList.toggle("light", mode === "light"); state.theme = mode; if (state.me) api("/api/profile", { method: "PUT", body: JSON.stringify({ theme: mode }) }).catch(() => {}); applyTranslations(); }
function setLanguage(lang) { state.language = lang; if (state.me) api("/api/profile", { method: "PUT", body: JSON.stringify({ language: lang }) }).catch(() => {}); applyTranslations(); }
function fmtTimer(sec) { const m = Math.floor(sec / 60).toString().padStart(2, "0"); const s = Math.floor(sec % 60).toString().padStart(2, "0"); return `${m}:${s}`; }
function getParams() { return new URL(location.href).searchParams; }
function getTestId() { return getParams().get("testId"); }
function getMode() { return getParams().get("mode") || "practice"; }
function qModeLabel(mode) { if (mode === "exam") return "Exam Mode"; if (mode === "hard") return "Hard Mode"; return "Practice Mode"; }

async function boot() {
  const me = await api("/api/me").catch(() => ({ user: null }));
  state.me = me.user;
  if (state.me?.theme) setTheme(state.me.theme);
  if (state.me?.language) state.language = state.me.language;
  applyTranslations();

  if ($("#themeBtn")) $("#themeBtn").onclick = () => { setTheme(state.theme === "dark" ? "light" : "dark"); sfx(); };
  if ($("#langBtn")) $("#langBtn").onclick = () => { setLanguage(state.language === "en" ? "hinglish" : "en"); sfx(); };
  if ($("#soundBtn")) $("#soundBtn").onclick = () => { state.sound = !state.sound; applyTranslations(); sfx(); };

  const page = document.body.dataset.page;
  if (page === "login") return loginInit();
  if (page === "signup") return signupInit();
  if (page === "forgot") return forgotInit();
  if (page === "dashboard") return dashboardInit();
  if (page === "profile") return profileInit();
  if (page === "test") return testInit();
  if (page === "admin") return adminInit();
}

async function loginInit() {
  if (state.me) location.href = "/dashboard";
  $("#loginBtn").onclick = async () => {
    try {
      const user = await api("/api/login", { method: "POST", body: JSON.stringify({ username: $("#loginUser").value, password: $("#loginPass").value }) });
      state.me = user.user;
      location.href = "/dashboard";
    } catch (e) { alert(e.error || "Login failed"); sfx("bad"); }
  };
}
async function signupInit() {
  if (state.me) location.href = "/dashboard";
  $("#signupBtn").onclick = async () => {
    try {
      const r = await fetch("/api/signup", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ name: $("#signupName").value, username: $("#signupUser").value, password: $("#signupPass").value }) });
      const data = await r.json();
      if (!r.ok) throw data;
      state.me = data.user;
      location.href = "/dashboard";
    } catch (e) { alert(e.error || "Signup failed"); sfx("bad"); }
  };
}
async function forgotInit() {
  $("#fpBtn").onclick = async () => {
    try {
      await api("/api/forgot-password", { method: "POST", body: JSON.stringify({ username: $("#fpUser").value, newPassword: $("#fpPass").value }) });
      alert("Password updated");
      location.href = "/";
    } catch (e) { alert(e.error || "Reset failed"); }
  };
}

function renderAvatarTarget(el, url) {
  if (!el) return;
  if (url) el.innerHTML = `<img src="${url}" alt="avatar" style="width:42px;height:42px;border-radius:14px;object-fit:cover;">`;
  else el.innerHTML = "";
}

async function dashboardInit() {
  if (!state.me) return (location.href = "/");
  $("#helloName").textContent = `${state.me.name || state.me.username}`;
  $("#helloMeta").textContent = `@${state.me.username} • ${state.me.role}`;
  renderAvatarTarget($("#dashAvatar"), state.me.profilePicUrl);

  $("#logoutBtn").onclick = async () => { await api("/api/logout", { method: "POST" }).catch(() => {}); location.href = "/"; };
  $("#refreshTests").onclick = loadTests;
  $("#openLeaderboard").onclick = showLeaderboard;
  $("#searchBtn").onclick = searchUsers;
  $("#searchBox").addEventListener("keydown", (e) => { if (e.key === "Enter") searchUsers(); });
  $$(".chip").forEach((b) => b.addEventListener("click", () => { $$(".chip").forEach((x) => x.classList.remove("active")); b.classList.add("active"); state.mode = b.dataset.mode; loadTests(); }));

  $("#stats").innerHTML = `
    <div class="stat"><div class="k">${state.me.bestScore || 0}</div><div class="l">Best score</div></div>
    <div class="stat"><div class="k">${state.me.streak || 0}</div><div class="l">Streak</div></div>
    <div class="stat"><div class="k">${state.me.privacy || "private"}</div><div class="l">Privacy</div></div>
    <div class="stat"><div class="k">${state.me.language || "en"}</div><div class="l">Language</div></div>
  `;

  await loadTests();
  await loadAnalytics();
  await loadWeeklyTopper();
}

async function loadWeeklyTopper() {
  try {
    const data = await api("/api/weekly-topper");
    const top = data.topper;
    if (!top) return $("#weeklyTopperBox").innerHTML = `<div class="item">No weekly topper yet.</div>`;
    $("#weeklyTopperBox").innerHTML = `
      <div class="row">
        ${top.profilePicUrl ? `<img src="${top.profilePicUrl}" style="width:56px;height:56px;border-radius:16px;object-fit:cover;">` : `<div class="logo" style="width:56px;height:56px;border-radius:16px;"></div>`}
        <div><strong>${top.name || top.username}</strong><div class="small">Score: ${top.score} • Time: ${top.timeTaken || 0}s</div></div>
      </div>
    `;
  } catch {
    $("#weeklyTopperBox").innerHTML = `<div class="item">Unable to load weekly topper.</div>`;
  }
}

async function loadTests() {
  try {
    const data = await api("/api/tests");
    state.tests = data.tests || [];
    $("#testsList").innerHTML = state.tests.length ? state.tests.map((tst) => `
      <div class="item">
        <div class="spread">
          <div><strong>${tst.title}</strong><div class="small">${tst.questions.length} questions • ${tst.series || "default"} • ${tst.locked ? "Locked" : "Open"}</div></div>
          <div class="row"><button class="pill" data-preview="${tst.id}">${t("preview")}</button><button class="pill" data-start="${tst.id}">${t("start")} ${state.mode}</button></div>
        </div>
      </div>
    `).join("") : `<div class="item">No tests available yet.</div>`;
    $$("#testsList [data-preview]").forEach((b) => b.onclick = () => previewTest(b.dataset.preview));
    $$("#testsList [data-start]").forEach((b) => b.onclick = () => location.href = `/test?testId=${encodeURIComponent(b.dataset.start)}&mode=${encodeURIComponent(state.mode)}`);
  } catch (e) {
    $("#testsList").innerHTML = `<div class="item">${e.error || "Failed to load tests"}</div>`;
  }
}

async function previewTest(id) {
  const data = await api(`/api/tests/${id}?mode=${state.mode}`);
  const tdata = data.test;
  openModal(`
    <h3>${tdata.title}</h3>
    <p class="subtle">Subject: ${tdata.subject} • Type: ${tdata.type} • Series: ${tdata.series || "-"}</p>
    <div class="hr"></div>
    <div class="list">${tdata.questions.slice(0, 6).map((q, i) => `<div class="item"><strong>${i + 1}. ${q.question}</strong><div class="small">Chapter: ${q.chapter} • Difficulty: ${q.difficulty} • Year: ${q.year}</div></div>`).join("")}</div>
    <div class="hr"></div>
    <div class="row"><button class="btn" onclick="closeModal()">Close</button><button class="btn primary" onclick="location.href='/test?testId=${encodeURIComponent(tdata.id)}&mode=${encodeURIComponent(state.mode)}'">Start</button></div>
  `);
}

async function searchUsers() {
  const q = $("#searchBox").value.trim();
  if (!q) return;
  const data = await api(`/api/search/users?q=${encodeURIComponent(q)}`).catch(() => ({ results: [] }));
  $("#searchResults").innerHTML = data.results.length ? data.results.map((u) => `
    <div class="item">
      <div class="row">
        ${u.profilePicUrl ? `<img src="${u.profilePicUrl}" style="width:44px;height:44px;border-radius:14px;object-fit:cover;">` : `<div class="logo" style="width:44px;height:44px;border-radius:14px;"></div>`}
        <div style="flex:1"><strong>${u.name}</strong><div class="small">@${u.username} • ${u.bestScore || 0} • ${u.privacy || "private"}</div></div>
        <button class="pill" data-openuser="${u.username}">Open</button>
      </div>
    </div>
  `).join("") : `<div class="item">No users found.</div>`;
  $$("#searchResults [data-openuser]").forEach((b) => b.onclick = () => openPublicProfile(b.dataset.openuser));
}

async function openPublicProfile(username) {
  try {
    const data = await api(`/api/profile/public/${encodeURIComponent(username)}`);
    const u = data.user;
    openModal(`
      <h3>${u.name}</h3>
      <div class="hr"></div>
      <div class="row">
        ${u.profilePicUrl ? `<img src="${u.profilePicUrl}" style="width:72px;height:72px;border-radius:18px;object-fit:cover;">` : `<div class="logo" style="width:72px;height:72px;border-radius:18px;"></div>`}
        <div><strong>@${u.username}</strong><div class="small">Best score: ${u.bestScore || 0}</div><div class="small">Privacy: ${u.privacy}</div></div>
      </div>
    `);
  } catch (e) { alert(e.error || "Cannot open profile"); }
}

async function loadAnalytics() {
  const a = await api(`/api/analytics/${state.me.username}`);
  $("#analyticsBox").innerHTML = `
    <div class="item">Accuracy: <strong>${a.accuracy}%</strong></div>
    <div class="item">Avg time/question: <strong>${a.avgTime}s</strong></div>
    <div class="item">Weakest chapters: <strong>${a.weakest.map(x => x.chapter).join(", ") || "-"}</strong></div>
    <div class="item">Strongest chapters: <strong>${a.strongest.map(x => x.chapter).join(", ") || "-"}</strong></div>
    <div class="item">Insights: <strong>${(a.smartInsights || []).join(", ") || "-"}</strong></div>
  `;
  const s = await api(`/api/suggestions/${state.me.username}`);
  $("#suggestionsBox").innerHTML = `
    <div class="item">Predicted score after 3 tests: <strong>${s.predictedScoreAfter3Tests}</strong></div>
    <div class="item">Focus chapters: <strong>${(s.focusChapters || []).join(", ") || "-"}</strong></div>
    <div class="item">Avg speed: <strong>${s.avgSpeed || 0}s/question</strong></div>
    <div class="item">Accuracy: <strong>${s.accuracy || 0}%</strong></div>
  `;
}

async function showLeaderboard() {
  const lb = await api("/api/leaderboard");
  const rows = (lb.global || []).slice(0, 20);
  openModal(`
    <h3>Leaderboard</h3>
    <div class="hr"></div>
    <div class="list">
      ${rows.map((r) => `
        <div class="item">
          <div class="row">
            ${r.profilePicUrl ? `<img src="${r.profilePicUrl}" style="width:44px;height:44px;border-radius:14px;object-fit:cover;">` : `<div class="logo" style="width:44px;height:44px;border-radius:14px;"></div>`}
            <div style="flex:1"><strong>#${r.rank} ${r.name || r.username}</strong><div class="small">@${r.username} • Score: ${r.score} • Time: ${r.timeTaken || 0}s</div></div>
            <button class="pill" onclick="openPublicProfile('${r.username}')">Report/Visit</button>
          </div>
        </div>
      `).join("")}
    </div>
  `);
}

async function profileInit() {
  if (!state.me) return (location.href = "/");
  const data = await api(`/api/profile/public/${encodeURIComponent(state.me.username)}`);
  const u = data.user;
  $("#profileName").textContent = u.name || u.username;
  $("#profileUser").textContent = `@${u.username}`;
  $("#pName").value = u.name || "";
  $("#pInsta").value = u.instagram || "";
  $("#pWhats").value = u.whatsapp || "";
  $("#pPriv").value = u.privacy || "private";
  if (u.profilePicUrl) { $("#profilePreview").src = u.profilePicUrl; $("#profilePreview").style.display = "block"; }

  $("#saveProfile").onclick = async () => {
    const fd = new FormData();
    fd.append("name", $("#pName").value);
    fd.append("instagram", $("#pInsta").value);
    fd.append("whatsapp", $("#pWhats").value);
    fd.append("password", $("#pPass").value);
    fd.append("privacy", $("#pPriv").value);
    fd.append("language", state.language);
    fd.append("theme", state.theme);
    const file = $("#pPic").files[0];
    if (file) fd.append("profilePic", file);
    const r = await fetch("/api/profile", { method: "PUT", body: fd, credentials: "same-origin" });
    const out = await r.json();
    if (!r.ok) return alert(out.error || "Save failed");
    location.reload();
  };

  $("#deleteAccount").onclick = async () => {
    const confirmText = prompt('Type exactly: yes delete my account');
    if (confirmText !== "yes delete my account") return alert("Confirmation failed");
    await api("/api/delete-account", { method: "POST", body: JSON.stringify({ confirmText }) });
    location.href = "/";
  };
}

async function testInit() {
  const testId = getTestId();
  const mode = getMode();
  state.mode = mode;
  $("#modeBox").textContent = qModeLabel(mode);
  $("#submitBtn").textContent = mode === "practice" ? "Finish Practice" : "Submit Test";
  if (!testId) { $("#questionText").textContent = "No test selected."; return; }

  const data = await api(`/api/tests/${testId}?mode=${mode}`);
  state.activeTest = data.test;
  $("#testTitle").textContent = state.activeTest.title;
  $("#testMeta").textContent = `${state.activeTest.questions.length} questions • ${state.activeTest.series || "default"} • ${mode.toUpperCase()}`;

  const progress = await api(`/api/progress/${testId}/${mode}`).catch(() => ({ progress: null }));
  const p = progress.progress?.payload || {};
  state.answers = p.answers || Array(state.activeTest.questions.length).fill(null);
  state.marked = new Set(p.marked || []);
  state.bookmarked = new Set(p.bookmarked || []);
  state.notes = p.notes || {};
  state.currentIndex = p.currentIndex || 0;
  state.paused = !!p.paused;
  state.timer = Number(p.timer || 0);
  state.startedAt = p.startedAt || new Date().toISOString();

  renderPalette();
  renderQuestion();
  startTimer();

  $("#homeBtn").onclick = () => location.href = "/dashboard";
  $("#pauseBtn").onclick = () => { state.paused = !state.paused; $("#pauseBtn").textContent = state.paused ? "Resume" : "Pause"; };
  $("#saveBtn").onclick = async () => { await saveProgress(); alert("Saved"); };
  $("#resumeBtn").onclick = async () => { await saveProgress(); location.rel