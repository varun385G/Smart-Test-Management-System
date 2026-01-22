const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema({
  testId: String,
  studentName: String,
  studentReg: String,
  answers: [Number],
  score: Number,
  total: Number,
  submittedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Result", resultSchema);
