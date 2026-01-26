const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
  {
    testId: String,
    studentName: String,
    studentReg: String,

    // 🔥 FIX: allow MCQ / MSQ / NAT
    answers: {
      type: [mongoose.Schema.Types.Mixed],
      required: true
    },

    score: Number,
    total: Number
  },
  { timestamps: true }
);

module.exports = mongoose.model("Result", resultSchema);
