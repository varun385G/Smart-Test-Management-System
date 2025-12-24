const Result = require("./models/Result");
console.log("🔥 RUNNING THIS SERVER FILE 🔥");
// ================= IMPORTS =================
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");

const Staff = require("./models/Staff");
const Test = require("./models/Test");

// ================= APP INIT =================
const app = express();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json()); // MUST be before routes

// ================= DATABASE =================
mongoose.connect("mongodb://127.0.0.1:27017/smartTest")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

// ================= API HEALTH CHECK =================
app.get("/api/health", (req, res) => {
  res.send("API is running");
});

// ================= STAFF LOGIN =================
app.post("/api/staff/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const staff = await Staff.findOne({ email });
    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    const match = await bcrypt.compare(password, staff.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid password" });
    }

    res.json({
    message: "Login successful",
    staffId: staff._id,
    name: staff.name,
    role: staff.role // 🔥 NEW
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
    console.log("📥 Incoming test data:", req.body);

    const {
      title,
      password,
      duration,
      shuffleQuestions,
      shuffleOptions,
      security,
      questions,
      staffId
    } = req.body;

    if (!title || !password || !questions || questions.length === 0) {
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
      createdBy: staffId
    });

    await newTest.save();

    console.log("✅ Test saved:", newTest.testId);

    res.status(201).json({
      message: "Test created successfully",
      testId: newTest.testId
    });

  } catch (err) {
    console.error("❌ CREATE TEST ERROR:", err);
    res.status(500).json({ message: "Failed to create test" });
  }
});

// ================= FRONTEND (STATIC) =================
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

app.get("/api/tests/by-staff/:staffId", async (req, res) => {
  try {
    const tests = await Test.find({ createdBy: req.params.staffId })
      .sort({ createdAt: -1 });

    res.json(tests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch tests" });
  }
});
// ================= SERVER START =================
app.delete("/api/tests/:id", async (req, res) => {
  try {
    console.log("🗑 Deleting test ID:", req.params.id);

    const deleted = await Test.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Test not found" });
    }

    res.json({ message: "Test deleted successfully" });
  } catch (err) {
    console.error("DELETE TEST ERROR:", err);
    res.status(500).json({ message: "Failed to delete test" });
  }
});
app.post("/api/exam/submit", async (req, res) => {
  try {
    const { testId, studentName, studentReg, answers } = req.body;

    // Prevent reattempt
    const already = await Result.findOne({ testId, studentReg });
    if (already) {
      return res.status(403).json({ message: "Already attempted" });
    }

    const test = await Test.findOne({ testId });
    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

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
      total: test.questions.length
    });

    await result.save();

    res.json({
      message: "Exam submitted",
      score,
      total: test.questions.length
    });

  } catch (err) {
    console.error("SUBMIT ERROR:", err);
    res.status(500).json({ message: "Submit failed" });
  }
});
app.get("/api/results/:testId", async (req, res) => {
  try {
    const results = await Result.find({ testId: req.params.testId });
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch results" });
  }
});
app.get("/api/result/:testId/:reg", async (req, res) => {
  try {
    const result = await Result.findOne({
      testId: req.params.testId,
      studentReg: req.params.reg
    });

    if (!result) {
      return res.status(404).json({ message: "Result not found" });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch result" });
  }
});
app.post("/api/student/validate", async (req, res) => {
  try {
    const { testId, password, reg } = req.body;

    const test = await Test.findOne({ testId });
    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    if (test.password !== password) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // Prevent reattempt
    const attempted = await Result.findOne({ testId, studentReg: reg });
    if (attempted) {
      return res.status(403).json({ message: "Already attempted" });
    }

    res.json({ message: "Validated" });

  } catch (err) {
    console.error("VALIDATION ERROR:", err);
    res.status(500).json({ message: "Validation failed" });
  }
});
app.get("/api/tests/:testId", async (req, res) => {
  try {
    const test = await Test.findOne({ testId: req.params.testId });

    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    res.json({
      title: test.title,
      duration: test.duration,
      shuffleQuestions: test.shuffleQuestions,
      shuffleOptions: test.shuffleOptions,
      security: test.security,
      questions: test.questions
    });

  } catch (err) {
    console.error("FETCH TEST ERROR:", err);
    res.status(500).json({ message: "Failed to load test" });
  }
});
app.get("/debug/fix-admin-role", async (req, res) => {
  await Staff.updateOne(
    { email: "admin@test.com" },
    { $set: { role: "admin" } }
  );

  res.send("Admin role fixed");
});
// ================= ADMIN CREATE STAFF =================
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
      role: "staff"
    });

    res.json({ message: "Staff account created successfully" });

  } catch (err) {
    console.error("CREATE STAFF ERROR:", err);
    res.status(500).json({ message: "Failed to create staff" });
  }
});
// ================= ADMIN: LIST STAFF =================
app.get("/api/admin/staff", async (req, res) => {
  try {
    const staff = await Staff.find({ role: "staff" }).select("-password");
    res.json(staff);
  } catch (err) {
    console.error("LIST STAFF ERROR:", err);
    res.status(500).json({ message: "Failed to fetch staff" });
  }
});
// ================= ADMIN: DELETE STAFF =================
app.delete("/api/admin/staff/:id", async (req, res) => {
  try {
    const deleted = await Staff.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Staff not found" });
    }

    res.json({ message: "Staff deleted successfully" });
  } catch (err) {
    console.error("DELETE STAFF ERROR:", err);
    res.status(500).json({ message: "Failed to delete staff" });
  }
});
// ================= ADMIN: VIEW ALL RESULTS =================
app.get("/api/admin/results", async (req, res) => {
  try {
    const results = await Result.find();

    const tests = await Test.find().populate("createdBy", "name email");

    // Map testId → staff info
    const testMap = {};
    tests.forEach(test => {
      testMap[test.testId] = {
        title: test.title,
        staffName: test.createdBy?.name || "Unknown",
        staffEmail: test.createdBy?.email || "Unknown"
      };
    });

    const enrichedResults = results.map(r => ({
      testId: r.testId,
      testTitle: testMap[r.testId]?.title,
      staffName: testMap[r.testId]?.staffName,
      studentName: r.studentName,
      studentReg: r.studentReg,
      score: r.score,
      total: r.total,
      submittedAt: r.createdAt
    }));

    res.json(enrichedResults);

  } catch (err) {
    console.error("ADMIN RESULTS ERROR:", err);
    res.status(500).json({ message: "Failed to fetch results" });
  }
});


app.get("/api/admin/results/grouped", async (req, res) => {
  try {
    const tests = await Test.find()
      .populate("createdBy", "name");

    const results = await Result.find();

    const staffMap = {};

    tests.forEach(test => {
      const staffId = test.createdBy._id.toString();

      if (!staffMap[staffId]) {
        staffMap[staffId] = {
          staffName: test.createdBy.name,
          tests: {}
        };
      }

      staffMap[staffId].tests[test.testId] = {
        testTitle: test.title,
        results: []
      };
    });

    results.forEach(r => {
      const test = tests.find(t => t.testId === r.testId);
      if (!test) return;

      const staffId = test.createdBy._id.toString();

      staffMap[staffId].tests[r.testId].results.push({
        studentName: r.studentName,
        studentReg: r.studentReg,
        score: r.score,
        total: r.total,
        date: r.createdAt
      });
    });

    res.json(staffMap);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load admin results" });
  }
});
app.listen(3000, () => {
  console.log("Server started on port 3000");
});
