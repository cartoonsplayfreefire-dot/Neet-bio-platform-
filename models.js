const mongoose = require("mongoose");

const profilePicSchema = new mongoose.Schema(
  {
    data: { type: String, default: "" },
    mime: { type: String, default: "" }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    username: { type: String, unique: true, index: true },
    password: { type: String, default: "" },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    profilePic: { type: profilePicSchema, default: () => ({ data: "", mime: "" }) },
    instagram: { type: String, default: "" },
    whatsapp: { type: String, default: "" },
    language: { type: String, enum: ["en", "hinglish"], default: "en" },
    theme: { type: String, enum: ["dark", "light"], default: "dark" },
    privacy: { type: String, enum: ["private", "public"], default: "private" },
    streak: { type: Number, default: 0 },
    bestScore: { type: Number, default: 0 },
    bestTime: { type: Number, default: null },
    banned: { type: Boolean, default: false },
    banReason: { type: String, default: "" },
    banUntil: { type: Date, default: null },
    restrictedUntil: { type: Date, default: null }
  },
  { timestamps: true }
);

const questionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    question: String,
    options: [String],
    correctAnswer: String,
    explanation: String,
    hint: String,
    chapter: String,
    difficulty: String,
    year: Number,
    testSeries: String
  },
  { _id: false }
);

const testSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subject: { type: String, default: "biology" },
    type: { type: String, default: "full_syllabus_mixed" },
    published: { type: Boolean, default: true },
    locked: { type: Boolean, default: false },
    series: { type: String, default: "default" },
    questions: [questionSchema]
  },
  { timestamps: true }
);

testSchema.index({ subject: 1, type: 1 });

const attemptSchema = new mongoose.Schema(
  {
    username: { type: String, index: true },
    testId: { type: String, index: true },
    mode: { type: String, enum: ["practice", "exam", "hard"], default: "practice" },
    score: Number,
    maxScore: Number,
    correct: Number,
    wrong: Number,
    blank: Number,
    accuracy: Number,
    avgTime: Number,
    timeTaken: Number,
    startedAt: String,
    finishedAt: String,
    answers: [String],
    notes: { type: Object, default: {} },
    bookmarks: [Number],
    marked: [Number],
    evaluated: { type: Array, default: [] }
  },
  { timestamps: true }
);

const progressSchema = new mongoose.Schema(
  {
    username: { type: String, index: true },
    testId: { type: String, index: true },
    mode: { type: String, index: true },
    payload: { type: Object, default: {} }
  },
  { timestamps: true }
);
progressSchema.index({ username: 1, testId: 1, mode: 1 }, { unique: true });

const mistakeSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, index: true },
    public: { type: Boolean, default: false },
    items: { type: Array, default: [] }
  },
  { timestamps: true }
);

const reportSchema = new mongoose.Schema(
  {
    username: { type: String, index: true },
    type: String,
    description: String,
    relatedUser: String,
    questionId: String,
    testId: String,
    targetKind: String,
    status: { type: String, default: "pending" },
    adminNotes: { type: String, default: "" },
    falseReport: { type: Boolean, default: false }
  },
  { timestamps: true }
);

const adminLogSchema = new mongoose.Schema(
  {
    by: String,
    action: String,
    details: Object
  },
  { timestamps: true }
);

module.exports = {
  User: mongoose.model("User", userSchema),
  Test: mongoose.model("Test", testSchema),
  Attempt: mongoose.model("Attempt", attemptSchema),
  Progress: mongoose.model("Progress", progressSchema),
  Mistake: mongoose.model("Mistake", mistakeSchema),
  Report: mongoose.model("Report", reportSchema),
  AdminLog: mongoose.model("AdminLog", adminLogSchema)
};