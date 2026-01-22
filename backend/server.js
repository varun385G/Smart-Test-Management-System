// ================= ENV =================
require("dotenv").config();

// ================= IMPORTS =================
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");

const Result = require("./models/Result");
const Staff = require("./models/Staff");
const Test = require("./models/Test");

console.log("🔥 SERVER FILE LOADED 🔥");

// ================= APP INIT =================
const app = express();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ================= DATABASE =================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ================= API HEALTH =================
app.get("/api/health", (req, res) => {
  res.send("API is running");
});

// ================= LOGIN (ADMIN & STAFF) =================
app.post("/api/staff/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const staff = await Staff.findOne({ email });
    if (!staff) return res.status(404).json({ message: "Staff not found" });

    const match = await bcrypt.compare(password, staff.password);
    if (!match) return res.status(401).json({ message: "Invalid password" });

    res.json({
      message: "Login successful",
      staffId: staff._id,
      name: staff.name,
      role: staff.role,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= TEST CREATION =================
function generateTestId() {
  return "ST-" + Math.floor(100000 + Math.random() * 900000);
}

app.post("/api/tests/create", async (req, res) => {
  try {
    const {
      title,
      password,
      duration,
      shuffleQuestions,
      shuffleOptions,
      questions,
      staffId,
    } = req.body;

    if (!title || !password || !questions?.length) {
      return res.status(400).json({ message: "Invalid test data" });
    }

    const newTest = new Test({
      testId: generateTestId(),
      title,
      password,
      duration,
      shuffleQuestions,
      shuffleOptions,
      questions,
      createdBy: staffId,
    });

    await newTest.save();

    res.status(201).json({
      message: "Test created successfully",
      testId: newTest.testId,
    });
  } catch (err) {
    console.error("CREATE TEST ERROR:", err);
    res.status(500).json({ message: "Failed to create test" });
  }
});

// ================= FRONTEND =================
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.get("/staff", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/staff.html"));
});

app.get("/student", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/student.html"));
});

app.get("/exam", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/exam.html"));
});

// ================= TEST MANAGEMENT =================
app.get("/api/tests/by-staff/:staffId", async (req, res) => {
  try {
    const tests = await Test.find({ createdBy: req.params.staffId }).sort({
      createdAt: -1,
    });
    res.json(tests);
  } catch {
    res.status(500).json({ message: "Failed to fetch tests" });
  }
});

app.delete("/api/tests/:id", async (req, res) => {
  try {
    const deleted = await Test.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Test not found" });
    res.json({ message: "Test deleted successfully" });
  } catch {
    res.status(500).json({ message: "Failed to delete test" });
  }
});

// ================= EXAM =================
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

app.get("/api/tests/:testId", async (req, res) => {
  const test = await Test.findOne({ testId: req.params.testId });
  if (!test) return res.status(404).json({ message: "Test not found" });

  res.json({
    title: test.title,
    duration: test.duration,
    shuffleQuestions: test.shuffleQuestions,
    shuffleOptions: test.shuffleOptions,
    questions: test.questions,
  });
});

app.post("/api/exam/submit", async (req, res) => {
  const { testId, studentName, studentReg, answers } = req.body;

  const already = await Result.findOne({ testId, studentReg });
  if (already)
    return res.status(403).json({ message: "Already attempted" });

  const test = await Test.findOne({ testId });
  if (!test) return res.status(404).json({ message: "Test not found" });

  let score = 0;
  test.questions.forEach((q, i) => {
    if (answers[i] === q.correctIndex) score++;
  });

  const result = new Result({
    testId,
    studentName,
    studentReg,
    answers,
    score,
    total: test.questions.length,
  });

  await result.save();

  res.json({
    message: "Exam submitted",
    score,
    total: test.questions.length,
  });
});

// ================= RESULTS =================
app.get("/api/results/:testId", async (req, res) => {
  const results = await Result.find({ testId: req.params.testId });
  res.json(results);
});

// ================= ADMIN: CREATE STAFF (WORKING) =================
app.post("/api/admin/create-staff", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const existing = await Staff.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Staff already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    await Staff.create({
      name,
      email,
      password: hashed,
      role: "staff",
    });

    res.json({ message: "Staff account created successfully" });
  } catch (err) {
    console.error("CREATE STAFF ERROR:", err);
    res.status(500).json({ message: "Failed to create staff" });
  }
});

// ================= SERVER START =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
