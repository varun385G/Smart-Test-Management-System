require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");

const Result = require("./models/Result");
const Staff = require("./models/Staff");
const Test = require("./models/Test");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= DATABASE ================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => {
    console.error("❌ MongoDB error:", err);
    process.exit(1);
  });

/* ================= HEALTH ================= */
app.get("/api/health", (req, res) => {
  res.json({ status: "API running" });
});

/* ================= STAFF LOGIN ================= */
app.post("/api/staff/login", async (req, res) => {
  const { email, password } = req.body;

  const staff = await Staff.findOne({ email });
  if (!staff) return res.status(404).json({ message: "Staff not found" });

  const match = await bcrypt.compare(password, staff.password);
  if (!match) return res.status(401).json({ message: "Invalid password" });

  res.json({
    staffId: staff._id,
    name: staff.name,
    role: staff.role
  });
});

/* ================= ADMIN: CREATE STAFF ================= */
app.post("/api/admin/create-staff", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const exists = await Staff.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: "Staff already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const staff = await Staff.create({
      name,
      email,
      password: hashed,
      role: role || "staff"
    });

    res.json({
      message: "Staff created",
      staffId: staff._id
    });
  } catch (err) {
    console.error("CREATE STAFF ERROR:", err);
    res.status(500).json({ message: "Failed to create staff" });
  }
});

/* ================= ADMIN: VIEW STAFF ================= */
app.get("/api/admin/staff", async (req, res) => {
  const staff = await Staff.find({}, "-password").sort({ createdAt: -1 });
  res.json(staff);
});

/* ================= ADMIN: DELETE STAFF ================= */
app.delete("/api/admin/staff/:id", async (req, res) => {
  await Staff.findByIdAndDelete(req.params.id);
  res.json({ message: "Staff deleted" });
});

/* ================= CREATE TEST ================= */
function generateTestId() {
  return "ST-" + Math.floor(100000 + Math.random() * 900000);
}

app.post("/api/tests/create", async (req, res) => {
  try {
    const { title, password, duration, questions, security, staffId } = req.body;

    const test = new Test({
      testId: generateTestId(),
      title,
      password,
      duration,
      questions,
      security,
      createdBy: staffId,
      resultsPublished: false
    });

    await test.save();
    res.json({ testId: test.testId });
  } catch (err) {
    console.error("CREATE TEST ERROR:", err);
    res.status(500).json({ message: "Failed to create test" });
  }
});

/* ================= FETCH TEST ================= */
app.get("/api/tests/:testId", async (req, res) => {
  const test = await Test.findOne({ testId: req.params.testId });
  if (!test) return res.status(404).json({ message: "Test not found" });
  res.json(test);
});

/* ================= TESTS BY STAFF ================= */
app.get("/api/tests/by-staff/:staffId", async (req, res) => {
  const tests = await Test.find({ createdBy: req.params.staffId }).sort({ createdAt: -1 });

  const enriched = await Promise.all(
    tests.map(async t => ({
      _id: t._id,
      testId: t.testId,
      title: t.title,
      resultsPublished: t.resultsPublished,
      attempts: await Result.countDocuments({ testId: t.testId })
    }))
  );

  res.json(enriched);
});

/* ================= DELETE TEST ================= */
app.delete("/api/tests/:id", async (req, res) => {
  await Test.findByIdAndDelete(req.params.id);
  res.json({ message: "Test deleted" });
});

/* ================= PUBLISH RESULTS ================= */
app.post("/api/tests/:testId/publish-results", async (req, res) => {
  const test = await Test.findOne({ testId: req.params.testId });
  if (!test) return res.status(404).json({ message: "Test not found" });

  test.resultsPublished = true;
  await test.save();

  res.json({ message: "Results published" });
});

/* ================= STUDENT VALIDATE ================= */
app.post("/api/student/validate", async (req, res) => {
  const { testId, password, reg } = req.body;

  const test = await Test.findOne({ testId });
  if (!test) return res.status(404).json({ message: "Test not found" });

  if (test.password !== password)
    return res.status(401).json({ message: "Invalid password" });

  const attempted = await Result.findOne({ testId, studentReg: reg });

  if (attempted) {
    return res.json({
      attempted: true,
      resultsPublished: test.resultsPublished
    });
  }

  res.json({ attempted: false });
});

/* ================= SUBMIT EXAM ================= */
app.post("/api/exam/submit", async (req, res) => {
  try {
    const { testId, studentName, studentReg, answers } = req.body;

    const test = await Test.findOne({ testId });
    if (!test) return res.status(404).json({ message: "Test not found" });

    const exists = await Result.findOne({ testId, studentReg });
    if (exists) return res.json({ message: "Already submitted" });

    let score = 0;

    test.questions.forEach((q, i) => {
      const ans = answers[i];

      if (q.type === "MCQ" && ans === q.correctIndex) score++;

      if (
        q.type === "MSQ" &&
        Array.isArray(ans) &&
        Array.isArray(q.correctIndexes) &&
        ans.sort().join(",") === q.correctIndexes.sort().join(",")
      ) score++;

      if (q.type === "NAT" && ans === q.correctValue) score++;
    });

    const safeAnswers = answers.map(a =>
      Array.isArray(a) ? [...a] : a
    );

    await Result.create({
      testId,
      studentName,
      studentReg,
      answers: safeAnswers,
      score,
      total: test.questions.length
    });

    res.json({ message: "Submitted" });
  } catch (err) {
    console.error("SUBMIT ERROR:", err);
    res.status(500).json({ message: "Submit failed" });
  }
});

/* ================= STAFF VIEW RESULTS ================= */
app.get("/api/results/:testId", async (req, res) => {
  const test = await Test.findOne({ testId: req.params.testId });
  if (!test) return res.status(404).json({ message: "Test not found" });

  if (!test.resultsPublished)
    return res.status(403).json({ message: "Results not published" });

  const results = await Result.find({ testId: req.params.testId });
  res.json(results);
});

/* ================= STUDENT RESULT ================= */
app.get("/api/student/result/:testId/:reg", async (req, res) => {
  const test = await Test.findOne({ testId: req.params.testId });
  if (!test || !test.resultsPublished)
    return res.status(403).json({ message: "Results not available" });

  const result = await Result.findOne({
    testId: req.params.testId,
    studentReg: req.params.reg
  });

  if (!result) return res.status(404).json({ message: "Result not found" });
  res.json(result);
});

/* ================= ADMIN RESULTS ================= */
app.get("/api/admin/results/grouped", async (req, res) => {
  const staffList = await Staff.find({ role: "staff" });
  const tests = await Test.find().populate("createdBy");
  const results = await Result.find();

  const grouped = {};

  staffList.forEach(s => {
    grouped[s._id.toString()] = { staffName: s.name, tests: {} };
  });

  tests.forEach(t => {
    if (!t.createdBy || !grouped[t.createdBy._id.toString()]) return;

    grouped[t.createdBy._id.toString()].tests[t.testId] = {
      testTitle: t.title,
      resultsPublished: t.resultsPublished,
      results: []
    };
  });

  results.forEach(r => {
    Object.values(grouped).forEach(s => {
      if (s.tests[r.testId]) s.tests[r.testId].results.push(r);
    });
  });

  res.json(grouped);
});

/* ================= FRONTEND ================= */
app.use(express.static(path.join(__dirname, "../frontend")));
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "../frontend/index.html"))
);

/* ================= START ================= */
app.listen(process.env.PORT || 3000, () =>
  console.log("🚀 Server running")
);
