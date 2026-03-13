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

module.exports = mongoose.model("Result", resultSchema);