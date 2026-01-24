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

// ================= MIDDLEWARE =================
app.use(cors({ origin: "*", methods: ["GET", "POST", "DELETE"] }));
app.use(express.json());

// ================= DATABASE =================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => {
    console.error("❌ MongoDB error:", err);
    process.exit(1);
  });

// ================= HEALTH =================
app.get("/api/health", (req, res) => {
  res.json({ status: "API running" });
});

// ================= STAFF LOGIN =================
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

// ================= CREATE TEST =================
function generateTestId() {
  return "ST-" + Math.floor(100000 + Math.random() * 900000);
}

app.post("/api/tests/create", async (req, res) => {
  const {
    title,
    password,
    duration,
    shuffleQuestions,
    shuffleOptions,
    questions,
    security,
    staffId
  } = req.body;

  const test = new Test({
    testId: generateTestId(),
    title,
    password,
    duration,
    shuffleQuestions,
    shuffleOptions,
    questions,
    security,
    createdBy: staffId
  });

  await test.save();
  res.json({ testId: test.testId });
});

// ================= FETCH TEST =================
app.get("/api/tests/:testId", async (req, res) => {
  const test = await Test.findOne({ testId: req.params.testId });
  if (!test) return res.status(404).json({ message: "Test not found" });

  res.json(test);
});

// ================= TESTS BY STAFF =================
app.get("/api/tests/by-staff/:staffId", async (req, res) => {
  const tests = await Test.find({ createdBy: req.params.staffId });

  const enhanced = await Promise.all(
    tests.map(async t => {
      const attempts = await Result.countDocuments({ testId: t.testId });
      return { ...t.toObject(), attempts };
    })
  );

  res.json(enhanced);
});

// ================= DELETE TEST =================
app.delete("/api/tests/:id", async (req, res) => {
  await Test.findByIdAndDelete(req.params.id);
  res.json({ message: "Test deleted" });
});

// ================= STUDENT VALIDATE =================
app.post("/api/student/validate", async (req, res) => {
  const { testId, password, reg } = req.body;

  const test = await Test.findOne({ testId });
  if (!test) return res.status(404).json({ message: "Test not found" });

  if (test.password !== password)
    return res.status(401).json({ message: "Invalid password" });

  const attempted = await Result.findOne({ testId, studentReg: reg });
  if (attempted)
    return res.status(403).json({ message: "Already attempted" });

  res.json({ message: "Validated" });
});

// ================= SUBMIT EXAM =================
app.post("/api/exam/submit", async (req, res) => {
  const { testId, studentName, studentReg, answers } = req.body;

  const test = await Test.findOne({ testId });
  if (!test) return res.status(404).json({ message: "Test not found" });

  let score = 0;
  test.questions.forEach((q, i) => {
    if (answers[i] === q.correctIndex) score++;
  });

  await Result.create({
    testId,
    studentName,
    studentReg,
    answers,
    score,
    total: test.questions.length
  });

  res.json({ score, total: test.questions.length });
});

// ================= RESULTS =================
app.get("/api/results/:testId", async (req, res) => {
  const results = await Result.find({ testId: req.params.testId });
  res.json(results);
});
// ================= EXPORT RESULTS CSV =================
app.get("/api/results/:testId/csv", async (req, res) => {
  try {
    const results = await Result.find({ testId: req.params.testId });

    if (!results.length) {
      return res.status(404).send("No results found");
    }

    let csv = "Student Name,Register Number,Score,Total,Percentage,Date\n";

    results.forEach(r => {
      const percent = Math.round((r.score / r.total) * 100);
      csv += `"${r.studentName}","${r.studentReg}",${r.score},${r.total},${percent},"${r.submittedAt.toLocaleString()}"\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="results_${req.params.testId}.csv"`
    );

    res.send(csv);
  } catch (err) {
    console.error("CSV EXPORT ERROR:", err);
    res.status(500).send("Failed to export CSV");
  }
});

// ================= ADMIN STAFF =================
app.get("/api/admin/staff", async (req, res) => {
  const staff = await Staff.find({ role: "staff" }).select("-password");
  res.json(staff);
});

app.post("/api/admin/create-staff", async (req, res) => {
  const { name, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  await Staff.create({ name, email, password: hashed, role: "staff" });
  res.json({ message: "Staff created" });
});

app.delete("/api/admin/staff/:id", async (req, res) => {
  await Staff.findByIdAndDelete(req.params.id);
  res.json({ message: "Staff deleted" });
});

// ================= ADMIN: FULL STAFF → TEST → RESULT VIEW =================
app.get("/api/admin/results/grouped", async (req, res) => {
  try {
    const staffList = await Staff.find({ role: "staff" });
    const tests = await Test.find().populate("createdBy");
    const results = await Result.find();

    const grouped = {};

    // 1. Initialize ALL staff
    staffList.forEach(staff => {
      grouped[staff._id.toString()] = {
        staffName: staff.name,
        tests: {}
      };
    });

    // 2. Attach ALL tests to correct staff
    tests.forEach(test => {
      if (!test.createdBy) return;

      const staffId = test.createdBy._id.toString();

      if (!grouped[staffId]) {
        grouped[staffId] = {
          staffName: test.createdBy.name,
          tests: {}
        };
      }

      grouped[staffId].tests[test.testId] = {
        testTitle: test.title,
        results: []
      };
    });

    // 3. Attach ALL results to correct tests
    results.forEach(r => {
      Object.values(grouped).forEach(staff => {
        if (staff.tests[r.testId]) {
          staff.tests[r.testId].results.push({
            studentName: r.studentName,
            studentReg: r.studentReg,
            score: r.score,
            total: r.total,
            date: r.submittedAt
          });
        }
      });
    });

    res.json(grouped);
  } catch (err) {
    console.error("ADMIN RESULTS ERROR:", err);
    res.status(500).json({ message: "Failed to load admin results" });
  }
});

// ================= FRONTEND =================
app.use(express.static(path.join(__dirname, "../frontend")));

// SAFE REDIRECTS
app.get("/staff", (req, res) => res.redirect("/staff.html"));
app.get("/student", (req, res) => res.redirect("/student.html"));
app.get("/dashboard", (req, res) => res.redirect("/dashboard.html"));
app.get("/create-staff", (req, res) => res.redirect("/create-staff.html"));
app.get("/manage-staff", (req, res) => res.redirect("/manage-staff.html"));

// ================= HOME =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ================= START =================
app.listen(process.env.PORT || 3000, () =>
  console.log("🚀 Server running")
);
