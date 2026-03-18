require('dotenv').config();

const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const path      = require('path');
const bcrypt    = require('bcrypt');
const crypto    = require('crypto');

const Result = require('./models/Result');
const Staff  = require('./models/Staff');
const Test         = require('./models/Test');
const QuestionBank = require('./models/QuestionBank');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

/* ─────────────── DATABASE ─────────────── */
mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 50,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 60000,
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => { console.error('❌ MongoDB error:', err); process.exit(1); });

/* ─────────────── SESSION MODEL ─────────────── */
// Stored in MongoDB so tokens survive Render restarts / spin-down
const sessionSchema = new mongoose.Schema({
  token:       { type: String, required: true, unique: true, index: true },
  testId:      String,
  studentReg:  String,
  studentName: { type: String, default: '' },
  createdAt:   { type: Date, default: Date.now, expires: 14400 }
});
const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);

/* ─────────────── HEALTH ─────────────── */
app.get('/api/health', (req, res) => res.json({ status: 'API running' }));

/* ─────────────── STAFF LOGIN ─────────────── */
app.post('/api/staff/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const staff = await Staff.findOne({ email });
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    const match = await bcrypt.compare(password, staff.password);
    if (!match) return res.status(401).json({ message: 'Invalid password' });
    res.json({ staffId: staff._id, name: staff.name, role: staff.role });
  } catch (err) {
    res.status(500).json({ message: 'Login failed' });
  }
});

/* ─────────────── ADMIN: CREATE STAFF ─────────────── */
app.post('/api/admin/create-staff', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' });
    const exists = await Staff.findOne({ email });
    if (exists) return res.status(409).json({ message: 'Staff already exists' });
    const hashed = await bcrypt.hash(password, 10);
    const staff  = await Staff.create({ name, email, password: hashed, role: role || 'staff' });
    res.json({ message: 'Staff created', staffId: staff._id });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create staff' });
  }
});

/* ─────────────── ADMIN: VIEW / DELETE STAFF ─────────────── */
app.get('/api/admin/staff', async (req, res) => {
  const staff = await Staff.find({}, '-password').sort({ createdAt: -1 });
  res.json(staff);
});
app.delete('/api/admin/staff/:id', async (req, res) => {
  try {
    const staff = await Staff.findByIdAndDelete(req.params.id);
    if (staff) {
      const tests = await Test.find({ createdBy: req.params.id });
      for (const t of tests) {
        await Result.deleteMany({ testId: t.testId });
      }
      await Test.deleteMany({ createdBy: req.params.id });
    }
    res.json({ message: 'Staff deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete staff' });
  }
});

/* ─────────────── ADMIN: RESET STAFF PASSWORD ─────────────── */
app.put('/api/admin/staff/:id/reset-password', async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4)
      return res.status(400).json({ message: 'Password must be at least 4 characters' });
    const hashed = await bcrypt.hash(newPassword, 10);
    const staff = await Staff.findByIdAndUpdate(req.params.id, { password: hashed });
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

/* ─────────────── STAFF: UPDATE OWN EMAIL OR PASSWORD ─────────────── */
app.put('/api/staff/update-credentials', async (req, res) => {
  try {
    const { staffId, currentPassword, newEmail, newPassword } = req.body;
    if (!staffId || !currentPassword)
      return res.status(400).json({ message: 'Missing required fields' });

    const staff = await Staff.findById(staffId);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });

    const match = await bcrypt.compare(currentPassword, staff.password);
    if (!match) return res.status(401).json({ message: 'Current password is incorrect' });

    if (newEmail) {
      const exists = await Staff.findOne({ email: newEmail });
      if (exists && exists._id.toString() !== staffId)
        return res.status(409).json({ message: 'That email is already in use' });
      staff.email = newEmail;
    }
    if (newPassword) {
      if (newPassword.length < 4)
        return res.status(400).json({ message: 'New password must be at least 4 characters' });
      staff.password = await bcrypt.hash(newPassword, 10);
    }

    await staff.save();
    res.json({ message: 'Credentials updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update credentials' });
  }
});

/* ─────────────── CREATE TEST ─────────────── */
async function generateUniqueTestId() {
  for (let i = 0; i < 10; i++) {
    const id = 'ST-' + Math.floor(100000 + Math.random() * 900000);
    const exists = await Test.findOne({ testId: id });
    if (!exists) return id;
  }
  throw new Error('Could not generate unique test ID');
}

app.post('/api/tests/create', async (req, res) => {
  try {
    const { title, password, duration, questions, security, shuffleQuestions, shuffleOptions, staffId, scheduledStart, scheduledEnd, submitAfterMinutes } = req.body;
    const test = new Test({
      testId: await generateUniqueTestId(),
      title, password, duration,
      questions: questions || [],
      shuffleQuestions: shuffleQuestions !== false,
      shuffleOptions:   shuffleOptions   !== false,
      security: security || {},
      createdBy: staffId,
      resultsPublished: false,
      scheduledStart: scheduledStart ? new Date(scheduledStart) : null,
      scheduledEnd:   scheduledEnd   ? new Date(scheduledEnd)   : null,
      submitAfterMinutes: submitAfterMinutes ? Number(submitAfterMinutes) : null,
    });
    await test.save();
    res.json({ testId: test.testId });
  } catch (err) {
    console.error('CREATE TEST ERROR:', err);
    res.status(500).json({ message: 'Failed to create test' });
  }
});

/* ─────────────── UPDATE TEST ─────────────── */
app.put('/api/tests/:testId/update', async (req, res) => {
  try {
    const test = await Test.findOne({ testId: req.params.testId });
    if (!test) return res.status(404).json({ message: 'Test not found' });

    const { title, password, duration, questions, security, shuffleQuestions, shuffleOptions, scheduledStart, scheduledEnd, submitAfterMinutes } = req.body;
    if (title    !== undefined) test.title    = title;
    if (password !== undefined) test.password = password;
    if (duration !== undefined && duration)  test.duration = Number(duration);
    if (questions)       test.questions        = questions;
    if (security)        test.security         = security;
    if (shuffleQuestions !== undefined) test.shuffleQuestions = shuffleQuestions;
    if (shuffleOptions   !== undefined) test.shuffleOptions   = shuffleOptions;
    test.scheduledStart = scheduledStart ? new Date(scheduledStart) : null;
    test.scheduledEnd   = scheduledEnd   ? new Date(scheduledEnd)   : null;
    test.submitAfterMinutes = submitAfterMinutes ? Number(submitAfterMinutes) : null;

    await test.save();
    res.json({ message: 'Test updated', testId: test.testId });
  } catch (err) {
    console.error('UPDATE TEST ERROR:', err);
    res.status(500).json({ message: 'Failed to update test' });
  }
});

/* ─────────────── STAFF RESULTS STATS ─────────────── */
app.get('/api/results/by-staff/:staffId', async (req, res) => {
  try {
    const tests = await Test.find({ createdBy: req.params.staffId });
    const testIds = tests.map(t => t.testId);
    const results = await Result.find({ testId: { $in: testIds }, total: { $gt: 0 } });
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Failed' });
  }
});

/* ─────────────── TESTS BY STAFF ─────────────── */
app.get('/api/tests/by-staff/:staffId', async (req, res) => {
  try {
    const tests = await Test.find({ createdBy: req.params.staffId }).sort({ createdAt: -1 });
    const enriched = await Promise.all(
      tests.map(async t => {
        const attempts = await Result.countDocuments({ testId: t.testId });
        const locked   = await Result.countDocuments({ testId: t.testId, isLocked: true });
        return {
          _id: t._id,
          testId: t.testId,
          title: t.title,
          resultsPublished: t.resultsPublished,
          attempts,
          lockedCount: locked,
          scheduledStart: t.scheduledStart,
          scheduledEnd:   t.scheduledEnd,
        };
      })
    );
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load tests' });
  }
});

/* ─────────────── FETCH TEST ─────────────── */
app.get('/api/tests/:testId', async (req, res) => {
  try {
    const test = await Test.findOne({ testId: req.params.testId });
    if (!test) return res.status(404).json({ message: 'Test not found' });
    res.json(test);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch test' });
  }
});

/* ─────────────── DELETE TEST ─────────────── */
app.delete('/api/tests/:id', async (req, res) => {
  try {
    const test = await Test.findByIdAndDelete(req.params.id);
    if (test) {
      await Result.deleteMany({ testId: test.testId });
    }
    res.json({ message: 'Test deleted' });
  } catch (err) {
    console.error('DELETE TEST ERROR:', err);
    res.status(500).json({ message: 'Failed to delete test' });
  }
});

/* ─────────────── PUBLISH RESULTS ─────────────── */
app.post('/api/tests/:testId/publish-results', async (req, res) => {
  try {
    const test = await Test.findOne({ testId: req.params.testId });
    if (!test) return res.status(404).json({ message: 'Test not found' });
    test.resultsPublished = true;
    await test.save();
    res.json({ message: 'Results published' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to publish results' });
  }
});

/* ─────────────── STUDENT VALIDATE ─────────────── */
app.post('/api/student/validate', async (req, res) => {
  try {
  const { testId, password, reg } = req.body;
  const test = await Test.findOne({ testId });
  if (!test) return res.status(404).json({ message: 'Test not found' });
  if (test.password !== password) return res.status(401).json({ message: 'Invalid password' });

  const existing = await Result.findOne({ testId, studentReg: reg });
  if (existing) {
    if (existing.isLocked) {
      return res.json({
        attempted: true,
        isLocked: true,
        lockCode: existing.lockCode,
        violationLog: existing.violationLog || [],
        resultsPublished: test.resultsPublished
      });
    }
    const examInProgress = !existing.isForceSubmitted && (existing.score === 0 || existing.score === null || existing.score === undefined) && !existing.remainingSeconds;
    const neverSubmitted = !existing.isForceSubmitted && (existing.total === 0 || existing.total === null || existing.total === undefined);
    if (neverSubmitted || (examInProgress && existing.answers && existing.answers.length > 0)) {
      return res.json({
        attempted: false,
        canResume: true,
        scheduledStart: test.scheduledStart || null
      });
    }
    return res.json({
      attempted: true,
      isLocked: false,
      isForceSubmitted: existing.isForceSubmitted || false,
      resultsPublished: test.resultsPublished
    });
  }

  const now = new Date();
  if (test.scheduledStart && now < test.scheduledStart) {
    const minsUntilStart = (new Date(test.scheduledStart) - now) / 60000;
    if (minsUntilStart > 2) {
      return res.status(403).json({
        message: 'Exam has not started yet. Scheduled start: ' + new Date(test.scheduledStart).toLocaleString(),
        scheduledStart: test.scheduledStart,
        minsUntilStart: Math.ceil(minsUntilStart)
      });
    }
  }
  if (test.scheduledEnd && now > test.scheduledEnd) {
    return res.status(403).json({
      message: 'Exam window has ended. It ended at: ' + new Date(test.scheduledEnd).toLocaleString(),
      scheduledEnd: test.scheduledEnd
    });
  }

  res.json({
    attempted: false,
    scheduledStart: test.scheduledStart || null
  });
  } catch (err) {
    res.status(500).json({ message: 'Validation failed. Please try again.' });
  }
});

/* ─────────────── SCORING HELPER ─────────────── */
function calculateScore(test, answers) {
  let score = 0;
  const breakdown = [];

  test.questions.forEach((q, i) => {
    const ans = answers ? answers[i] : undefined;
    const marks = Number(q.marks) || 1;
    const negEnabled = q.negativeMarkingEnabled || false;
    const negMarks   = Number(q.negativeMarks) || 0;
    let earned = 0;
    let detail = { qi: i, type: q.type, marks, earned: 0, note: '', attempted: false };

    if (q.type === 'MCQ') {
      if (ans === null || ans === undefined) {
        detail.note = 'Not attempted';
        detail.attempted = false;
      } else {
        detail.attempted = true;
        if (ans === q.correctIndex) {
          earned = marks;
          detail.note = 'Correct';
        } else {
          if (negEnabled) {
            earned = -negMarks;
            detail.note = 'Wrong (-' + negMarks + ')';
          } else {
            detail.note = 'Wrong';
          }
        }
      }

    } else if (q.type === 'MSQ') {
      if (!Array.isArray(ans) || ans.length === 0) {
        detail.note = 'Not attempted';
        detail.attempted = false;
      } else {
        detail.attempted = true;
        const correct = q.correctIndexes || [];
        const totalCorrect = correct.length;
        if (totalCorrect === 0) {
          detail.note = 'No correct answers defined';
        } else {
          const rightPicks  = ans.filter(x => correct.includes(x)).length;
          const wrongPicks  = ans.filter(x => !correct.includes(x)).length;
          const netCorrect  = Math.max(0, rightPicks - wrongPicks);
          earned = parseFloat(((netCorrect / totalCorrect) * marks).toFixed(2));
          detail.note = rightPicks + '/' + totalCorrect + ' correct' + (wrongPicks > 0 ? ', ' + wrongPicks + ' wrong' : '') + ' -> ' + earned + ' marks';
        }
      }

    } else if (q.type === 'NAT') {
      if (ans === null || ans === undefined || ans === '') {
        detail.note = 'Not attempted';
        detail.attempted = false;
      } else {
        detail.attempted = true;
        const studentVal = parseFloat(String(ans).trim());
        const correctVal = parseFloat(String(q.correctValue).trim());
        const isCorrect  = !isNaN(studentVal) && !isNaN(correctVal) && studentVal === correctVal;
        if (isCorrect) {
          earned = marks;
          detail.note = 'Correct';
        } else {
          if (negEnabled) {
            earned = -negMarks;
            detail.note = 'Wrong (-' + negMarks + ')';
          } else {
            detail.note = 'Wrong';
          }
        }
      }
    }

    detail.earned = earned;
    score += earned;
    breakdown.push(detail);
  });

  score = Math.max(0, parseFloat(score.toFixed(2)));
  return { score, breakdown };
}

/* ─────────────── SUBMIT EXAM ─────────────── */
app.post('/api/exam/submit', async (req, res) => {
  try {
    const { testId, studentName, studentReg, answers, violationLog } = req.body;
    const test = await Test.findOne({ testId });
    if (!test) return res.status(404).json({ message: 'Test not found' });

    const existing = await Result.findOne({ testId, studentReg });
    if (existing && existing.isForceSubmitted) {
      return res.json({ message: 'Already force-submitted', score: existing.score, total: existing.total });
    }
    // Block re-submission if already scored normally (total > 0 and not locked)
    if (existing && !existing.isLocked && existing.total > 0) {
      return res.json({ message: 'Already submitted', score: existing.score, total: existing.total });
    }

    const { score, breakdown } = calculateScore(test, answers);
    const total = parseFloat(test.questions.reduce((s, q) => s + (Number(q.marks) || 1), 0).toFixed(2));

    await Result.findOneAndUpdate(
      { testId, studentReg },
      {
        $set: {
          studentName,
          answers: (answers || []).map(a => Array.isArray(a) ? [...a] : a),
          score, total,
          scoreBreakdown: breakdown,
          violationLog: violationLog || [],
          isLocked: false,
          lockCode: '',
          remainingSeconds: 0
        }
      },
      { upsert: true, new: true }
    );

    res.json({ message: 'Submitted', score, total });
  } catch (err) {
    console.error('SUBMIT ERROR:', err);
    res.status(500).json({ message: 'Submit failed' });
  }
});

/* ─────────────── LOCK EXAM (malpractice) ─────────────── */
app.post('/api/exam/lock', async (req, res) => {
  try {
    const { testId, studentName, studentReg, answers, violationLog } = req.body;
    const test = await Test.findOne({ testId });
    if (!test) return res.status(404).json({ message: 'Test not found' });

    let existing = await Result.findOne({ testId, studentReg });
    const lockCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    if (existing) {
      existing.violationLog = violationLog || [];
      existing.isLocked = true;
      existing.lockCode = lockCode;
      existing.answers = (answers || []).map(a => Array.isArray(a) ? [...a] : a);
      await existing.save();
    } else {
      await Result.create({
        testId, studentName, studentReg,
        answers: (answers || []).map(a => Array.isArray(a) ? [...a] : a),
        score: 0, total: 0,
        scoreBreakdown: [],
        violationLog: violationLog || [],
        isLocked: true,
        lockCode
      });
    }

    res.json({ message: 'Locked', lockCode });
  } catch (err) {
    console.error('LOCK ERROR:', err);
    res.status(500).json({ message: 'Lock failed' });
  }
});

/* ─────────────── SAVE PROGRESS (periodic auto-save) ─────────────── */
app.post('/api/exam/save-progress', async (req, res) => {
  try {
    const { testId, studentName, studentReg, answers, remainingSeconds } = req.body;

    const updateData = {
      answers: (answers || []).map(a => Array.isArray(a) ? [...a] : a),
    };
    if (studentName) updateData.studentName = studentName;
    if (remainingSeconds !== undefined && remainingSeconds !== null) {
      updateData.remainingSeconds = remainingSeconds;
    }

    const result = await Result.findOneAndUpdate(
      { testId, studentReg, isForceSubmitted: { $ne: true } },
      { $set: updateData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (!result) {
      return res.json({ message: 'Already submitted' });
    }

    res.json({ message: 'Progress saved' });
  } catch (err) {
    if (err.code === 11000) {
      return res.json({ message: 'Already submitted' });
    }
    console.error('SAVE PROGRESS ERROR:', err);
    res.status(500).json({ message: 'Save failed' });
  }
});

/* ─────────────── CHECK LOCK STATUS ─────────────── */
app.get('/api/exam/lock-status/:testId/:reg', async (req, res) => {
  try {
    const result = await Result.findOne({ testId: req.params.testId, studentReg: req.params.reg });
    if (!result) return res.json({ isLocked: false, exists: false });
    res.json({
      isLocked: result.isLocked,
      exists: true,
      lockCode: result.isLocked ? result.lockCode : '',
      isForceSubmitted: result.isForceSubmitted || false,
      savedAnswers: result.answers || [],
      remainingSeconds: result.remainingSeconds ?? null
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed' });
  }
});

/* ─────────────── STAFF: GET LOCKED STUDENTS ─────────────── */
app.get('/api/exam/locked/:testId', async (req, res) => {
  try {
    const test = await Test.findOne({ testId: req.params.testId });
    if (!test) return res.status(404).json({ message: 'Test not found' });
    const locked = await Result.find({ testId: req.params.testId, isLocked: true });
    res.json(locked);
  } catch (err) {
    res.status(500).json({ message: 'Failed' });
  }
});

/* ─────────────── STAFF: UNLOCK / FORCE SUBMIT ─────────────── */
app.post('/api/exam/unlock', async (req, res) => {
  try {
    const { testId, studentReg, staffId, action } = req.body;
    const test = await Test.findOne({ testId });
    if (!test) return res.status(404).json({ message: 'Test not found' });
    if (test.createdBy.toString() !== staffId) return res.status(403).json({ message: 'Not authorized' });

    const result = await Result.findOne({ testId, studentReg });
    if (!result) return res.status(404).json({ message: 'Result not found' });

    if (action === 'unlock') {
      result.isLocked = false;
      result.lockCode = '';
      result.isForceSubmitted = false;
      await result.save();
      return res.json({ message: 'Unlocked' });
    }

    if (action === 'force-submit') {
      const { score, breakdown } = calculateScore(test, result.answers);
      const total = parseFloat(test.questions.reduce((s, q) => s + (Number(q.marks) || 1), 0).toFixed(2));
      result.score = score;
      result.total = total;
      result.scoreBreakdown = breakdown;
      result.isLocked = false;
      result.lockCode = '';
      result.isForceSubmitted = true;
      await result.save();
      return res.json({ message: 'Force submitted', score, total });
    }

    res.status(400).json({ message: 'Invalid action' });
  } catch (err) {
    console.error('UNLOCK ERROR:', err);
    res.status(500).json({ message: 'Unlock failed' });
  }
});

/* ─────────────── STAFF VIEW RESULTS ─────────────── */
app.get('/api/results/staff/:testId', async (req, res) => {
  try {
    const test = await Test.findOne({ testId: req.params.testId });
    if (!test) return res.status(404).json({ message: 'Test not found' });
    const results = await Result.find({ testId: req.params.testId });
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Failed' });
  }
});

/* ─────────────── ANALYTICS ─────────────── */
app.get('/api/results/analytics/:testId', async (req, res) => {
  try {
    const test = await Test.findOne({ testId: req.params.testId });
    if (!test) return res.status(404).json({ message: 'Test not found' });

    const results = await Result.find({ testId: req.params.testId, isLocked: false });
    const totalStudents = results.length;

    const analytics = test.questions.map((q, qi) => {
      let correct = 0, wrong = 0, unattempted = 0, partial = 0;

      results.forEach(r => {
        const bd = r.scoreBreakdown && r.scoreBreakdown[qi];
        if (bd) {
          if (!bd.attempted) unattempted++;
          else if (bd.note === 'Correct') correct++;
          else if (bd.earned > 0 && bd.earned < (bd.marks || 1)) partial++;
          else wrong++;
        } else {
          const ans = r.answers ? r.answers[qi] : undefined;
          if (ans === null || ans === undefined || (Array.isArray(ans) && ans.length === 0)) {
            unattempted++;
          } else if (q.type === 'MCQ') {
            ans === q.correctIndex ? correct++ : wrong++;
          } else if (q.type === 'MSQ') {
            const ci = q.correctIndexes || [];
            const chosen = Array.isArray(ans) ? ans : [];
            const right = chosen.filter(x => ci.includes(x)).length;
            if (right === ci.length && chosen.length === ci.length) correct++;
            else if (right > 0) partial++;
            else wrong++;
          } else if (q.type === 'NAT') {
            parseFloat(String(ans).trim()) === parseFloat(String(q.correctValue).trim()) ? correct++ : wrong++;
          }
        }
      });

      return {
        qi, question: q.question, type: q.type, marks: q.marks || 1,
        totalStudents, correct, wrong, unattempted, partial,
        correctPct: totalStudents ? Math.round((correct / totalStudents) * 100) : 0
      };
    });

    res.json({ testId: req.params.testId, title: test.title, totalStudents, analytics });
  } catch (err) {
    console.error('ANALYTICS ERROR:', err);
    res.status(500).json({ message: 'Failed' });
  }
});

/* ─────────────── STUDENT RESULT (published + rank) ─────────────── */
app.get('/api/student/result/:testId/:reg', async (req, res) => {
  try {
    const test = await Test.findOne({ testId: req.params.testId });
    if (!test || !test.resultsPublished) return res.status(403).json({ message: 'Results not available' });
    const result = await Result.findOne({ testId: req.params.testId, studentReg: req.params.reg });
    if (!result) return res.status(404).json({ message: 'Result not found' });
    const allResults = await Result.find({ testId: req.params.testId, isLocked: false }).sort({ score: -1 });
    const rank = allResults.findIndex(r => r.studentReg === req.params.reg) + 1;
    const totalStudents = allResults.length;
    const obj = result.toObject();
    obj.rank = rank;
    obj.totalStudents = totalStudents;
    res.json(obj);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load result' });
  }
});

/* ─────────────── STUDENT RESULTS (published gate) ─────────────── */
app.get('/api/results/:testId', async (req, res) => {
  try {
    const test = await Test.findOne({ testId: req.params.testId });
    if (!test) return res.status(404).json({ message: 'Test not found' });
    if (!test.resultsPublished) return res.status(403).json({ message: 'Results not published' });
    const results = await Result.find({ testId: req.params.testId });
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch results' });
  }
});

/* ─────────────── ADMIN RESULTS GROUPED ─────────────── */
app.get('/api/admin/results/grouped', async (req, res) => {
  try {
    const staffList = await Staff.find({ role: 'staff' });
    const tests     = await Test.find().populate('createdBy');
    const results   = await Result.find();
    const grouped   = {};
    staffList.forEach(s => {
      grouped[s._id.toString()] = { staffName: s.name, tests: {} };
    });
    tests.forEach(t => {
      if (!t.createdBy || !grouped[t.createdBy._id.toString()]) return;
      grouped[t.createdBy._id.toString()].tests[t.testId] = {
        testTitle: t.title, resultsPublished: t.resultsPublished, results: []
      };
    });
    results.forEach(r => {
      Object.values(grouped).forEach(s => {
        if (s.tests[r.testId]) s.tests[r.testId].results.push(r);
      });
    });
    res.json(grouped);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load grouped results' });
  }
});

/* ─────────────── SETUP SECURITY QUESTION ─────────────── */
app.post('/api/staff/security-question/setup', async (req, res) => {
  try {
    const { staffId, currentPassword, securityQuestion, securityAnswer } = req.body;
    if (!staffId || !currentPassword || !securityQuestion || !securityAnswer)
      return res.status(400).json({ message: 'All fields are required' });

    const staff = await Staff.findById(staffId);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });

    const match = await bcrypt.compare(currentPassword, staff.password);
    if (!match) return res.status(401).json({ message: 'Current password is incorrect' });

    staff.securityQuestion = securityQuestion.trim();
    staff.securityAnswer   = securityAnswer.trim().toLowerCase();
    await staff.save();
    res.json({ message: 'Security question saved successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save security question' });
  }
});

/* ─────────────── GET SECURITY QUESTION ─────────────── */
app.post('/api/staff/security-question/get', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const staff = await Staff.findOne({ email });
    if (!staff) return res.status(404).json({ message: 'No account found with this email' });
    if (!staff.securityQuestion)
      return res.status(404).json({ message: 'No security question set for this account. Contact another admin.' });
    res.json({ securityQuestion: staff.securityQuestion });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/* ─────────────── RESET PASSWORD VIA SECURITY QUESTION ─────────────── */
app.post('/api/staff/forgot-password', async (req, res) => {
  try {
    const { email, securityAnswer, newPassword } = req.body;
    if (!email || !securityAnswer || !newPassword)
      return res.status(400).json({ message: 'All fields are required' });
    if (newPassword.length < 4)
      return res.status(400).json({ message: 'New password must be at least 4 characters' });

    const staff = await Staff.findOne({ email });
    if (!staff) return res.status(404).json({ message: 'No account found with this email' });
    if (!staff.securityAnswer)
      return res.status(400).json({ message: 'No security question set. Contact another admin.' });

    if (staff.securityAnswer !== securityAnswer.trim().toLowerCase())
      return res.status(401).json({ message: 'Security answer is incorrect' });

    staff.password = await bcrypt.hash(newPassword, 10);
    await staff.save();
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

/* ─────────────── PUBLIC: STAFF NAME LOOKUP ─────────────── */
app.get('/api/staff/name/:id', async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id, 'name');
    if (!staff) return res.status(404).json({ name: null });
    res.json({ name: staff.name });
  } catch (err) {
    res.status(400).json({ name: null });
  }
});

/* ─────────────── QUESTION BANK ─────────────── */
app.get('/api/question-bank/subjects', async (req, res) => {
  try {
    const subjects = await QuestionBank.distinct('subject');
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch subjects' });
  }
});

app.get('/api/question-bank', async (req, res) => {
  try {
    const { subject, topic } = req.query;
    const filter = {};
    if (subject) filter.subject = subject;
    if (topic)   filter.topic   = { $regex: topic, $options: 'i' };
    const questions = await QuestionBank.find(filter).sort({ createdAt: -1 });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch question bank' });
  }
});

app.post('/api/question-bank', async (req, res) => {
  try {
    const { subject, topic, type, question, image, options, correctIndex, correctIndexes, correctValue, marks, negativeMarkingEnabled, negativeMarks, explanation, staffId } = req.body;
    if (!question) return res.status(400).json({ message: 'Question text is required' });
    const q = await QuestionBank.create({
      subject: subject || 'General', topic: topic || '',
      type, question, image, options, correctIndex, correctIndexes,
      correctValue, marks, negativeMarkingEnabled, negativeMarks,
      explanation, createdBy: staffId
    });
    res.json({ message: 'Saved to question bank', id: q._id });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save question' });
  }
});

app.delete('/api/question-bank/:id', async (req, res) => {
  try {
    await QuestionBank.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted from question bank' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete' });
  }
});

/* ─────────────── FEEDBACK ─────────────── */
const feedbackSchema = new (require('mongoose').Schema)({
  testId:      String,
  studentName: String,
  studentReg:  String,
  q1: Number, q2: Number, q3: Number, q4: Number,
  suggestion:  String,
  createdAt:   { type: Date, default: Date.now }
});
const Feedback = require('mongoose').models.Feedback ||
  require('mongoose').model('Feedback', feedbackSchema);

app.post('/api/feedback', async (req, res) => {
  try {
    const { testId, studentName, studentReg, q1, q2, q3, q4, suggestion } = req.body;
    if (!testId || !studentReg) return res.status(400).json({ message: 'Missing fields' });
    await Feedback.create({ testId, studentName, studentReg, q1, q2, q3, q4, suggestion: suggestion || '' });
    res.json({ message: 'Feedback saved' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save feedback' });
  }
});

app.get('/api/feedback/:testId', async (req, res) => {
  try {
    const test = await Test.findOne({ testId: req.params.testId });
    if (!test) return res.status(404).json({ message: 'Test not found' });
    const feedbacks = await Feedback.find({ testId: req.params.testId }).sort({ createdAt: -1 });
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch feedback' });
  }
});

/* ─────────────── SESSION TOKEN MANAGEMENT ─────────────── */
// Stored in MongoDB so tokens survive Render restarts / spin-down

app.post('/api/student/issue-token', async (req, res) => {
  try {
    const { testId, studentReg, studentName } = req.body;
    if (!testId || !studentReg) return res.status(400).json({ message: 'Missing fields' });
    const token = crypto.randomBytes(24).toString('hex');
    // Use upsert so 50+ concurrent students don't cause duplicate-key crashes
    await Session.findOneAndUpdate(
      { testId, studentReg },
      { $set: { token, studentName: studentName || '', createdAt: new Date() } },
      { upsert: true, new: true }
    );
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Failed to issue token' });
  }
});

app.post('/api/student/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(401).json({ valid: false });
    const session = await Session.findOne({ token });
    if (!session) return res.status(401).json({ valid: false });
    res.json({ valid: true, testId: session.testId, studentReg: session.studentReg, studentName: session.studentName });
  } catch (err) {
    res.json({ valid: true });
  }
});

app.post('/api/student/invalidate-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (token) await Session.deleteOne({ token });
    res.json({ message: 'Token invalidated' });
  } catch (err) {
    res.json({ message: 'Token invalidated' });
  }
});

/* ─────────────── STAFF: DELETE STUDENT ATTEMPT ─────────────── */
app.delete('/api/results/:testId/:studentReg', async (req, res) => {
  try {
    const { testId, studentReg } = req.params;
    const { staffId } = req.body;

    const test = await Test.findOne({ testId });
    if (!test) return res.status(404).json({ message: 'Test not found' });
    if (staffId && test.createdBy.toString() !== staffId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const deleted = await Result.findOneAndDelete({ testId, studentReg });
    if (!deleted) return res.status(404).json({ message: 'Result not found' });
    res.json({ message: 'Student attempt deleted. They can now re-attempt.' });
  } catch (err) {
    console.error('DELETE RESULT ERROR:', err);
    res.status(500).json({ message: 'Failed to delete result' });
  }
});

/* ─────────────── GLOBAL ERROR HANDLER ─────────────── */
app.use((err, req, res, next) => {
  console.error('UNHANDLED ERROR:', err);
  res.status(500).json({ message: 'An unexpected error occurred. Please try again.' });
});

/* ─────────────── KEEP-ALIVE PING (Render free tier) ─────────────── */
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_EXTERNAL_URL) {
  setInterval(() => {
    fetch(RENDER_EXTERNAL_URL + '/api/health').catch(() => {});
  }, 10 * 60 * 1000);
}

/* ─────────────── FRONTEND ─────────────── */
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

/* ─────────────── START ─────────────── */
app.listen(process.env.PORT || 3000, () => console.log('🚀 Server running'));