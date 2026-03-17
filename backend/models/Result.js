const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
  {
    testId: String,
    studentName: String,
    studentReg: String,

    answers: {
      type: [mongoose.Schema.Types.Mixed],
      required: true
    },

    score: Number,
    total: Number,

    // Per-question score breakdown (for partial marking display)
    scoreBreakdown: [mongoose.Schema.Types.Mixed],

    // Malpractice / lock system
    violationLog: [
      {
        reason: String,
        timestamp: Date
      }
    ],
    isLocked: { type: Boolean, default: false },
    lockCode: { type: String, default: "" },
    isForceSubmitted: { type: Boolean, default: false },
    remainingSeconds: { type: Number, default: null }
  },
  { timestamps: true }
);

// Compound index for fast lookups and upserts on (testId + studentReg)
// Fixes Issue 4: slow auto-saving due to full collection scans
resultSchema.index({ testId: 1, studentReg: 1 }, { unique: true });

module.exports = mongoose.model("Result", resultSchema);