require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const multer = require("multer");
const path = require("path");
const {
  User,
  Test,
  Attempt,
  Progress,
  Mistake,
  Report,
  AdminLog
} = require("./models");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL;
const SESSION_SECRET = process.env.SESSION_SECRET || "neet-bio-secret";

if (!MONGO_URL) {
  console.error("Missing MONGO_URL in environment");
  process.exit(1);
}

mongoose.connect(MONGO_URL).then(() => console.log("MongoDB connected")).catch((err) => {
  console.error(err);
  process.exit(1);
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }
});

app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { maxAge: 3 * 24 * 60 * 60 * 1000, httpOnly: true },
    store: MongoStore.create({ mongoUrl: MONGO_URL })
  })
);

app.use(express.static(path.join(__dirname, "public")));

const BIO_ONLY = ["biology"];
const ALLOWED_MODES = ["practice", "exam", "hard"];

function normalizeUsername(v) {
  return String(v || "").trim().toLowerCase();
}
function isPlainString(v) {
  return typeof v === "string" && v.trim().length > 0;
}
function nowISO() {
  return new Date().toISOString();
}
function avatarUrl(user) {
  if (!user?.profilePic?.data) return "";
  return `data:${user.profilePic.mime || "image/png"};base64,${user.profilePic.data}`;
}
function publicUser(user) {
  if (!user) return null;
  return {
    name: user.name,
    username: user.username,
    role: user.role,
    profilePicUrl: avatarUrl(user),
    instagram: user.instagram,
    whatsapp: user.whatsapp,
    language: user.language,
    theme: user.theme,
    privacy: user.privacy,
    streak: user.streak,
    bestScore: user.bestScore,
    bestTime: user.bestTime,
    banned: user.banned,
    banReason: user.banReason,
    banUntil: user.banUntil,
    restrictedUntil: user.restrictedUntil
  };
}
function seededShuffle(arr, seedText) {
  const out = [...arr];
  let seed = 0;
  for (let i = 0; i < seedText.length; i++) seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function scoreAttempt(test, answers) {
  const questions = test.questions || [];
  let correct = 0;
  let wrong = 0;
  let blank = 0;
  let totalTime = 0;
  const evaluated = questions.map((q, idx) => {
    const ans = answers?.[idx] ?? null;
    const ok = ans === q.correctAnswer;
    if (ans === null || ans === undefined || ans === "") blank++;
    else if (ok) correct++;
    else wrong++;
    totalTime += Number(q.timeSpent || 0);
    return {
      id: q.id,
      answer: ans,
      correctAnswer: q.correctAnswer,
      isCorrect: ok,
      chapter: q.chapter,
      difficulty: q.difficulty,
      year: q.year
    };
  });
  const score = correct * 4 - wrong;
  const maxScore = questions.length * 4;
  const answered = correct + wrong;
  const accuracy = answered ? Math.round((correct / answered) * 1000) / 10 : 0;
  const avgTime = questions.length ? Math.round((totalTime / questions.length) * 10) / 10 : 0;
  return { score, maxScore, correct, wrong, blank, accuracy, avgTime, evaluated };
}
function rankEstimate(score, accuracy, attemptsCount, avgTime) {
  const base = Math.max(1, Math.round(50000 - score * 120 - accuracy * 25 + attemptsCount * 40 + avgTime * 5));
  return {
    range: `${Math.max(1, Math.round(base * 0.82))} - ${Math.max(1, Math.round(base * 1.18))}`,
    confidence: Math.max(35, Math.min(92, Math.round(55 + accuracy / 2 - avgTime / 10)))
  };
}
async function logAdmin(by, action, details = {}) {
  await AdminLog.create({ by, action, details });
}

async function currentUser(req) {
  if (!req.session.username) return null;
  return User.findOne({ username: req.session.username });
}

async function requireAuth(req, res, next) {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  if (user.banned) return res.status(403).json({ error: "Banned", reason: user.banReason || "No reason", appeal: "@ayxn.era" });
  if (user.restrictedUntil && user.restrictedUntil.getTime() > Date.now()) {
    return res.status(403).json({ error: "Restricted", until: user.restrictedUntil });
  }
  req.user = user;
  next();
}
async function requireAdmin(req, res, next) {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  if (user.role !== "admin") return res.status(403).send("Access Denied");
  req.user = user;
  next();
}

async function seedDemo() {
  const count = await Test.countDocuments();
  if (count > 0) return;

  await Test.create({
    title: "NEET Biology Full Syllabus Mixed Demo",
    subject: "biology",
    type: "full_syllabus_mixed",
    published: true,
    locked: false,
    series: "demo",
    questions: [
      { id: "Q1", question: "Which organelle is known as the powerhouse of the cell?", options: ["Ribosome", "Mitochondria", "Golgi body", "Lysosome"], correctAnswer: "Mitochondria", explanation: "Mitochondria produce ATP during cellular respiration.", hint: "Think ATP.", chapter: "Cell: The Unit of Life", difficulty: "easy", year: 2021, testSeries: "demo" },
      { id: "Q2", question: "The site of light reaction in photosynthesis is:", options: ["Stroma", "Thylakoid membrane", "Cytosol", "Nucleus"], correctAnswer: "Thylakoid membrane", explanation: "Light reaction occurs on the thylakoid membranes.", hint: "Think grana.", chapter: "Photosynthesis in Higher Plants", difficulty: "medium", year: 2020, testSeries: "demo" },
      { id: "Q3", question: "Which hormone regulates blood sugar level?", options: ["Thyroxine", "Insulin", "Adrenaline", "Oxytocin"], correctAnswer: "Insulin", explanation: "Insulin lowers blood glucose level.", hint: "Pancreas is involved.", chapter: "Chemical Coordination and Integration", difficulty: "easy", year: 2019, testSeries: "demo" },
      { id: "Q4", question: "The genetic material in most organisms is:", options: ["Protein", "Lipid", "DNA", "Carbohydrate"], correctAnswer: "DNA", explanation: "DNA stores hereditary information.", hint: "Double helix.", chapter: "Molecular Basis of Inheritance", difficulty: "easy", year: 2022, testSeries: "demo" },
      { id: "Q5", question: "The basic structural and functional unit of kidney is:", options: ["Neuron", "Nephron", "Alveolus", "Sarcomere"], correctAnswer: "Nephron", explanation: "Nephron filters blood and forms urine.", hint: "Urine unit.", chapter: "Excretory Products and Their Elimination", difficulty: "easy", year: 2018, testSeries: "demo" }
    ]
  });
}

app.get("/", async (req, res) => {
  const user = await currentUser(req);
  if (user) return res.redirect("/dashboard");
  return res.sendFile(path.join(__dirname, "public", "login.html"));
});
app.get("/signup", (req, res) => res.sendFile(path.join(__dirname, "public", "signup.html")));
app.get("/forgot", (req, res) => res.sendFile(path.join(__dirname, "public", "forgot.html")));
app.get("/dashboard", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.redirect("/");
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});
app.get("/profile", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.redirect("/");
  res.sendFile(path.join(__dirname, "public", "profile.html"));
});
app.get("/test", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.redirect("/");
  res.sendFile(path.join(__dirname, "public", "test.html"));
});
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));

app.get("/api/me", async (req, res) => {
  const user = await currentUser(req);
  res.json({ user: user ? publicUser(user) : null });
});

app.post("/api/signup", async (req, res) => {
  try {
    const { name, username, password } = req.body;
    if (!isPlainString(name) || !isPlainString(username) || !isPlainString(password)) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const uname = normalizeUsername(username);
    const exists = await User.findOne({ username: uname });
    if (exists) return res.status(400).json({ error: "Username already exists" });

    const user = await User.create({
      name: name.trim(),
      username: uname,
      password: String(password),
      role: "user"
    });

    req.session.username = user.username;
    req.session.cookie.maxAge = 3 * 24 * 60 * 60 * 1000;
    res.json({ ok: true, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username: normalizeUsername(username), password: String(password) });
  if (!user) return res.status(400).json({ error: "Invalid credentials" });
  if (user.banned) return res.status(403).json({ error: "Banned", reason: user.banReason || "", appeal: "@ayxn.era" });
  req.session.username = user.username;
  req.session.cookie.maxAge = 3 * 24 * 60 * 60 * 1000;
  res.json({ ok: true, user: publicUser(user) });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.post("/api/forgot-password", async (req, res) => {
  const { username, newPassword } = req.body;
  if (!isPlainString(username) || !isPlainString(newPassword)) return res.status(400).json({ error: "Missing fields" });
  const user = await User.findOne({ username: normalizeUsername(username) });
  if (!user) return res.status(404).json({ error: "User not found" });
  user.password = String(newPassword);
  await user.save();
  res.json({ ok: true });
});

app.put("/api/profile", requireAuth, upload.single("profilePic"), async (req, res) => {
  const { name, instagram, whatsapp, language, theme, privacy, password } = req.body;
  const user = req.user;
  if (isPlainString(name)) user.name = name.trim();
  if (typeof instagram === "string") user.instagram = instagram;
  if (typeof whatsapp === "string") user.whatsapp = whatsapp;
  if (language === "en" || language === "hinglish") user.language = language;
  if (theme === "dark" || theme === "light") user.theme = theme;
  if (privacy === "public" || privacy === "private") user.privacy = privacy;
  if (isPlainString(password)) user.password = password;
  if (req.file) {
    user.profilePic = {
      data: req.file.buffer.toString("base64"),
      mime: req.file.mimetype || "image/png"
    };
  }
  await user.save();
  res.json({ ok: true, user: publicUser(user) });
});

app.post("/api/delete-account", requireAuth, async (req, res) => {
  const { confirmText } = req.body;
  if (confirmText !== "yes delete my account") return res.status(400).json({ error: "Second confirmation failed" });
  const username = req.user.username;
  await Promise.all([
    User.deleteOne({ username }),
    Attempt.deleteMany({ username }),
    Mistake.deleteOne({ username }),
    Progress.deleteMany({ username }),
    Report.deleteMany({ $or: [{ username }, { relatedUser: username }] })
  ]);
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/profile/public/:username", requireAuth, async (req, res) => {
  const target = normalizeUsername(req.params.username);
  const user = await User.findOne({ username: target });
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.privacy === "private" && target !== req.user.username && req.user.role !== "admin") {
    return res.status(403).json({ error: "Private profile" });
  }
  res.json({ user: publicUser(user) });
});

app.get("/api/search/users", requireAuth, async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (!q) return res.json({ results: [] });
  const users = await User.find({ $or: [{ username: new RegExp(q, "i") }, { name: new RegExp(q, "i") }] }).limit(20);
  res.json({
    results: users.map((u) => ({
      username: u.username,
      name: u.name,
      profilePicUrl: avatarUrl(u),
      bestScore: u.bestScore,
      privacy: u.privacy
    }))
  });
});

app.get("/api/tests", requireAuth, async (req, res) => {
  const tests = await Test.find().sort({ createdAt: -1 });
  const visible = tests.filter((t) => req.user.role === "admin" || (t.published !== false && t.locked !== true));
  res.json({ tests: visible.map((t) => ({ ...t.toObject(), id: String(t._id) })) });
});

app.get("/api/tests/:id", requireAuth, async (req, res) => {
  const test = await Test.findById(req.params.id);
  if (!test) return res.status(404).json({ error: "Test not found" });
  if (req.user.role !== "admin" && (test.published === false || test.locked === true)) {
    return res.status(403).json({ error: "Test locked/unpublished" });
  }
  const mode = String(req.query.mode || "practice");
  const order = seededShuffle(test.questions.map((_, i) => i), `${req.user.username}:${test._id}:${mode}`);
  const questions = order.map((idx) => test.questions[idx]);
  res.json({ test: { ...test.toObject(), id: String(test._id), questions, order } });
});

app.post("/api/progress/save", requireAuth, async (req, res) => {
  const { testId, mode, payload } = req.body;
  if (!testId || !mode) return res.status(400).json({ error: "Missing testId or mode" });
  await Progress.findOneAndUpdate(
    { username: req.user.username, testId, mode },
    { username: req.user.username, testId, mode, payload: payload || {} },
    { upsert: true, new: true }
  );
  res.json({ ok: true });
});

app.get("/api/progress/:testId/:mode", requireAuth, async (req, res) => {
  const progress = await Progress.findOne({ username: req.user.username, testId: req.params.testId, mode: req.params.mode });
  res.json({ progress });
});

app.post("/api/submit", requireAuth, async (req, res) => {
  const { testId, mode, answers, timeTaken, startedAt, finishedAt, notes, bookmarks, marked } = req.body;
  const test = await Test.findById(testId);
  if (!test) return res.status(404).json({ error: "Test not found" });
  const ans = Array.isArray(answers) ? answers : [];
  const scored = scoreAttempt(test, ans);

  const attempt = await Attempt.create({
    username: req.user.username,
    testId: String(test._id),
    mode,
    score: scored.score,
    maxScore: scored.maxScore,
    correct: scored.correct,
    wrong: scored.wrong,
    blank: scored.blank,
    accuracy: scored.accuracy,
    avgTime: scored.avgTime,
    timeTaken: Number(timeTaken || 0),
    startedAt: startedAt || nowISO(),
    finishedAt: finishedAt || nowISO(),
    answers: ans,
    notes: notes || {},
    bookmarks: bookmarks || [],
    marked: marked || [],
    evaluated: scored.evaluated
  });

  let mistake = await Mistake.findOne({ username: req.user.username });
  if (!mistake) mistake = await Mistake.create({ username: req.user.username, public: false, items: [] });
  for (let i = 0; i < scored.evaluated.length; i++) {
    const ev = scored.evaluated[i];
    const q = test.questions[i];
    if (!ev.isCorrect && ev.answer !== null && ev.answer !== undefined && ev.answer !== "") {
      const existing = mistake.items.find((m) => String(m.questionId) === String(q.id));
      if (existing) {
        existing.count = (existing.count || 1) + 1;
        existing.lastWrongAt = nowISO();
        existing.userAnswer = ev.answer;
      } else {
        mistake.items.push({
          questionId: q.id,
          testId: String(test._id),
          question: q.question,
          chapter: q.chapter,
          difficulty: q.difficulty,
          year: q.year,
          correctAnswer: q.correctAnswer,
          userAnswer: ev.answer,
          explanation: q.explanation,
          hint: q.hint,
          count: 1,
          mastered: false,
          lastWrongAt: nowISO()
        });
      }
    }
  }
  await mistake.save();

  if (attempt.score > (req.user.bestScore || 0)) {
    req.user.bestScore = attempt.score;
    req.user.bestTime = attempt.timeTaken;
  }
  req.user.streak = (req.user.streak || 0) + 1;
  await req.user.save();

  await Progress.deleteOne({ username: req.user.username, testId, mode });

  const rank = await buildLeaderboardRank(req.user.username);
  res.json({ ok: true, attempt, rank, rankPredict: rankEstimate(attempt.score, attempt.accuracy, await Attempt.countDocuments(), attempt.avgTime) });
});

async function buildLeaderboardRank(username) {
  const attempts = await Attempt.find({});
  const bestByUser = new Map();
  for (const a of attempts) {
    const prev = bestByUser.get(a.username);
    if (!prev) bestByUser.set(a.username, a);
    else {
      const better =
        a.score > prev.score ||
        (a.score === prev.score && a.timeTaken < prev.timeTaken) ||
        (a.score === prev.score && a.timeTaken === prev.timeTaken && a.createdAt < prev.createdAt);
      if (better) bestByUser.set(a.username, a);
    }
  }
  const rows = [...bestByUser.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.timeTaken !== b.timeTaken) return a.timeTaken - b.timeTaken;
    return a.createdAt - b.createdAt;
  });
  const idx = rows.findIndex((r) => r.username === username);
  return idx >= 0 ? idx + 1 : null;
}

app.get("/api/leaderboard", requireAuth, async (req, res) => {
  const attempts = await Attempt.find({});
  const bestByUser = new Map();
  for (const a of attempts) {
    const prev = bestByUser.get(a.username);
    if (!prev) bestByUser.set(a.username, a);
    else {
      const better =
        a.score > prev.score ||
        (a.score === prev.score && a.timeTaken < prev.timeTaken) ||
        (a.score === prev.score && a.timeTaken === prev.timeTaken && a.createdAt < prev.createdAt);
      if (better) bestByUser.set(a.username, a);
    }
  }
  const users = await User.find({ username: { $in: [...bestByUser.keys()] } });
  const userMap = new Map(users.map((u) => [u.username, u]));
  const global = [...bestByUser.values()]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.timeTaken !== b.timeTaken) return a.timeTaken - b.timeTaken;
      return a.createdAt - b.createdAt;
    })
    .map((a, i) => ({
      rank: i + 1,
      username: a.username,
      name: userMap.get(a.username)?.name || a.username,
      profilePicUrl: avatarUrl(userMap.get(a.username)),
      score: a.score,
      timeTaken: a.timeTaken,
      testId: a.testId,
      createdAt: a.createdAt
    }));
  res.json({ global, weekly: global.slice(0, 50) });
});

app.get("/api/weekly-topper", requireAuth, async (req, res) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const attempts = await Attempt.find({ createdAt: { $gte: since } });
  const bestByUser = new Map();
  for (const a of attempts) {
    const prev = bestByUser.get(a.username);
    if (!prev) bestByUser.set(a.username, a);
    else {
      const better = a.score > prev.score || (a.score === prev.score && a.timeTaken < prev.timeTaken);
      if (better) bestByUser.set(a.username, a);
    }
  }
  const rows = [...bestByUser.values()].sort((a, b) => b.score - a.score || a.timeTaken - b.timeTaken);
  const users = await User.find({ username: { $in: rows.map((r) => r.username) } });
  const userMap = new Map(users.map((u) => [u.username, u]));
  const topper = rows[0]
    ? {
        ...rows[0].toObject(),
        profilePicUrl: avatarUrl(userMap.get(rows[0].username)),
        name: userMap.get(rows[0].username)?.name || rows[0].username
      }
    : null;
  res.json({ topper, rows: rows.slice(0, 10).map((r) => ({ ...r.toObject(), profilePicUrl: avatarUrl(userMap.get(r.username)), name: userMap.get(r.username)?.name || r.username })) });
});

app.get("/api/mistakes/:username?", requireAuth, async (req, res) => {
  const target = normalizeUsername(req.params.username || req.user.username);
  const targetUser = await User.findOne({ username: target });
  if (!targetUser) return res.status(404).json({ error: "User not found" });
  if (targetUser.privacy === "private" && target !== req.user.username && req.user.role !== "admin") {
    return res.status(403).json({ error: "Private notebook" });
  }
  let record = await Mistake.findOne({ username: target });
  if (!record) record = { username: target, public: false, items: [] };
  res.json({ record });
});

app.post("/api/mistakes/:username/mark-mastered", requireAuth, async (req, res) => {
  const target = normalizeUsername(req.params.username);
  if (req.user.username !== target && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const { questionId } = req.body;
  const mistake = await Mistake.findOne({ username: target });
  if (!mistake) return res.status(404).json({ error: "Record not found" });
  const item = mistake.items.find((m) => String(m.questionId) === String(questionId));
  if (item) item.mastered = true;
  await mistake.save();
  res.json({ ok: true });
});

app.get("/api/analytics/:username?", requireAuth, async (req, res) => {
  const target = normalizeUsername(req.params.username || req.user.username);
  if (target !== req.user.username && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const attempts = await Attempt.find({ username: target });
  const mistake = (await Mistake.findOne({ username: target })) || { items: [] };

  const chapterMap = {};
  for (const a of attempts) {
    for (const ev of a.evaluated || []) {
      const ch = ev.chapter || "Unknown";
      if (!chapterMap[ch]) chapterMap[ch] = { correct: 0, wrong: 0, total: 0 };
      if (ev.answer === null || ev.answer === undefined || ev.answer === "") continue;
      chapterMap[ch].total++;
      if (ev.isCorrect) chapterMap[ch].correct++;
      else chapterMap[ch].wrong++;
    }
  }

  const chapterRows = Object.entries(chapterMap).map(([chapter, v]) => ({
    chapter,
    accuracy: v.total ? Math.round((v.correct / v.total) * 1000) / 10 : 0,
    correct: v.correct,
    wrong: v.wrong,
    total: v.total
  }));

  const weakest = [...chapterRows].sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);
  const strongest = [...chapterRows].sort((a, b) => b.accuracy - a.accuracy).slice(0, 3);
  const totalCorrect = attempts.reduce((s, a) => s + (a.correct || 0), 0);
  const totalWrong = attempts.reduce((s, a) => s + (a.wrong || 0), 0);
  const accuracy = totalCorrect + totalWrong ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 1000) / 10 : 0;
  const avgTime = attempts.length ? Math.round((attempts.reduce((s, a) => s + (a.avgTime || 0), 0) / attempts.length) * 10) / 10 : 0;
  const allAttempts = await Attempt.find({});
  const avgGlobalScore = allAttempts.length ? Math.round((allAttempts.reduce((s, a) => s + (a.score || 0), 0) / allAttempts.length) * 10) / 10 : 0;
  const smartInsights = (mistake.items || []).filter((m) => !m.mastered).slice(0, 5).map((m) => m.chapter);
  res.json({ weakest, strongest, accuracy, avgTime, avgGlobalScore, smartInsights });
});

app.get("/api/suggestions/:username?", requireAuth, async (req, res) => {
  const target = normalizeUsername(req.params.username || req.user.username);
  if (target !== req.user.username && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const attempts = await Attempt.find({ username: target });
  const mistake = (await Mistake.findOne({ username: target })) || { items: [] };
  const totalCorrect = attempts.reduce((s, a) => s + (a.correct || 0), 0);
  const totalWrong = attempts.reduce((s, a) => s + (a.wrong || 0), 0);
  const accuracy = totalCorrect + totalWrong ? (totalCorrect / (totalCorrect + totalWrong)) * 100 : 0;
  const avgTime = attempts.length ? attempts.reduce((s, a) => s + (a.avgTime || 0), 0) / attempts.length : 0;
  const chapterCounts = {};
  for (const item of mistake.items || []) {
    if (item.mastered) continue;
    chapterCounts[item.chapter] = (chapterCounts[item.chapter] || 0) + (item.count || 1);
  }
  const focusChapters = Object.entries(chapterCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([chapter]) => chapter);
  const predictedScoreAfter3Tests = Math.min(360, Math.round((accuracy / 100) * 360 - avgTime * 0.8 + attempts.length * 2));
  res.json({ focusChapters, predictedScoreAfter3Tests, avgSpeed: avgTime, accuracy: Math.round(accuracy * 10) / 10 });
});

app.get("/api/reports", requireAuth, async (req, res) => {
  if (req.user.role !== "admin") {
    const reports = await Report.find({ $or: [{ username: req.user.username }, { relatedUser: req.user.username }] }).sort({ createdAt: -1 });
    return res.json({ reports });
  }
  const reports = await Report.find().sort({ createdAt: -1 });
  res.json({ reports });
});

app.post("/api/reports", requireAuth, async (req, res) => {
  const { type, description, relatedUser, questionId, testId, targetKind } = req.body;
  if (!isPlainString(type) || !isPlainString(description)) return res.status(400).json({ error: "Missing report fields" });
  const report = await Report.create({
    username: req.user.username,
    type,
    description,
    relatedUser: relatedUser || "",
    questionId: questionId || "",
    testId: testId || "",
    targetKind: targetKind || "general",
    status: "pending",
    adminNotes: "",
    falseReport: false
  });
  res.json({ ok: true, report });
});

app.put("/api/admin/reports/:id", requireAdmin, async (req, res) => {
  const { status, adminNotes, falseReport } = req.body;
  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  if (status) report.status = status;
  if (typeof adminNotes === "string") report.adminNotes = adminNotes;
  if (typeof falseReport === "boolean") report.falseReport = falseReport;
  await report.save();
  await logAdmin(req.user.username, "report_update", { reportId: req.params.id, status, falseReport });
  res.json({ ok: true, report });
});

app.get("/api/admin/dashboard", requireAdmin, async (req, res) => {
  const [totalUsers, totalAttempts, totalReports, openReports, totalTests] = await Promise.all([
    User.countDocuments(),
    Attempt.countDocuments(),
    Report.countDocuments(),
    Report.countDocuments({ status: "pending" }),
    Test.countDocuments()
  ]);
  const topUsers = await Attempt.find().sort({ score: -1, timeTaken: 1, createdAt: 1 }).limit(10);
  res.json({ totalUsers, totalAttempts, totalReports, openReports, totalTests, topUsers });
});

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ users: users.map(publicUser) });
});

app.put("/api/admin/users/:username", requireAdmin, async (req, res) => {
  const uname = normalizeUsername(req.params.username);
  const user = await User.findOne({ username: uname });
  if (!user) return res.status(404).json({ error: "User not found" });
  const { action, reason, hours, newPassword, role, privacy, instagram, whatsapp } = req.body;
  if (action === "warn") user.lastWarning = reason || "Warning";
  if (action === "restrict") {
    user.restrictedUntil = new Date(Date.now() + Number(hours || 1) * 60 * 60 * 1000);
    user.banReason = reason || "Restricted by admin";
  }
  if (action === "ban") {
    user.banned = true;
    user.banReason = reason || "Banned by admin";
    user.banUntil = hours ? new Date(Date.now() + Number(hours) * 60 * 60 * 1000) : null;
  }
  if (action === "unban") {
    user.banned = false;
    user.banReason = "";
    user.banUntil = null;
  }
  if (typeof newPassword === "string" && newPassword.trim()) user.password = newPassword.trim();
  if (role === "admin" || role === "user") user.role = role;
  if (privacy === "public" || privacy === "private") user.privacy = privacy;
  if (typeof instagram === "string") user.instagram = instagram;
  if (typeof whatsapp === "string") user.whatsapp = whatsapp;
  await user.save();
  await logAdmin(req.user.username, action || "edit_user", { target: uname, reason, hours });
  res.json({ ok: true, user: publicUser(user) });
});

app.post("/api/admin/tests", requireAdmin, async (req, res) => {
  const { id, title, subject, type, published, locked, series, questions } = req.body;
  const chosenSubject = subject || "biology";
  if (!BIO_ONLY.includes(chosenSubject) && req.user.role !== "admin") return res.status(400).json({ error: "Only biology allowed" });
  if (type !== "full_syllabus_mixed") return res.status(400).json({ error: "Only full syllabus mixed tests allowed" });
  if (!Array.isArray(questions) || !questions.length) return res.status(400).json({ error: "Questions missing" });
  const test = await Test.create({
    _id: id || undefined,
    title: title || "Biology Full Syllabus Mixed Test",
    subject: chosenSubject,
    type: "full_syllabus_mixed",
    published: published !== false,
    locked: locked === true,
    series: series || "admin",
    questions
  });
  await logAdmin(req.user.username, "save_test", { testId: String(test._id), title: test.title });
  res.json({ ok: true, test: { ...test.toObject(), id: String(test._id) } });
});

app.post("/api/admin/tests/import", requireAdmin, upload.single("file"), async (req, res) => {
  try {
    const raw = req.file.buffer.toString("utf8");
    const incoming = JSON.parse(raw);
    const list = Array.isArray(incoming) ? incoming : [incoming];
    let count = 0;
    for (const t of list) {
      if (t.subject !== "biology") continue;
      if (t.type !== "full_syllabus_mixed") continue;
      if (!Array.isArray(t.questions)) continue;
      await Test.create({
        title: t.title || "Imported Biology Test",
        subject: "biology",
        type: "full_syllabus_mixed",
        published: t.published !== false,
        locked: !!t.locked,
        series: t.series || "imported",
        questions: t.questions
      });
      count++;
    }
    await logAdmin(req.user.username, "import_tests", { count });
    res.json({ ok: true, count });
  } catch {
    res.status(400).json({ error: "Invalid JSON upload" });
  }
});

app.delete("/api/admin/tests/:id", requireAdmin, async (req, res) => {
  await Test.deleteOne({ _id: req.params.id });
  await logAdmin(req.user.username, "delete_test", { testId: req.params.id });
  res.json({ ok: true });
});

app.put("/api/admin/tests/:id/lock", requireAdmin, async (req, res) => {
  const { locked, published } = req.body;
  const test = await Test.findById(req.params.id);
  if (!test) return res.status(404).json({ error: "Not found" });
  if (typeof locked === "boolean") test.locked = locked;
  if (typeof published === "boolean") test.published = published;
  await test.save();
  await logAdmin(req.user.username, "lock_toggle", { testId: req.params.id, locked, published });
  res.json({ ok: true, test: { ...test.toObject(), id: String(test._id) } });
});

app.get("/api/admin/logs", requireAdmin, async (req, res) => {
  const logs = await AdminLog.find().sort({ createdAt: -1 }).limit(200);
  res.json({ logs });
});

app.get("/api/export/mistakes/:username.txt", requireAuth, async (req, res) => {
  const target = normalizeUsername(req.params.username);
  if (target !== req.user.username && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const record = await Mistake.findOne({ username: target });
  const items = record?.items || [];
  let out = `Mistake Notebook - ${target}\n\n`;
  items.forEach((m, i) => {
    out += `${i + 1}. QID: ${m.questionId}\n`;
    out += `Chapter: ${m.chapter}\n`;
    out += `Question: ${m.question}\n`;
    out += `Your Answer: ${m.userAnswer}\n`;
    out += `Correct Answer: ${m.correctAnswer}\n`;
    out += `Explanation: ${m.explanation}\n`;
    out += `Hint: ${m.hint}\n`;
    out += `Mastered: ${m.mastered ? "Yes" : "No"}\n\n`;
  });
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${target}_mistakes.txt"`);
  res.send(out);
});

app.get("/api/admin/dashboard", requireAdmin, async (req, res) => {
  const totalUsers = await User.countDocuments();
  const totalAttempts = await Attempt.countDocuments();
  const totalReports = await Report.countDocuments();
  const openReports = await Report.countDocuments({ status: "pending" });
  const totalTests = await Test.countDocuments();
  const topUsers = await Attempt.find().sort({ score: -1, timeTaken: 1, createdAt: 1 }).limit(10);
  res.json({ totalUsers, totalAttempts, totalReports, openReports, totalTests, topUsers });
});

async function start() {
  await seedDemo();
  app.listen(PORT, () => console.log(`Server running on ${PORT}`));
}

start();