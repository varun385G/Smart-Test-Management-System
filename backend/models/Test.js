const mongoose = require("mongoose");

const testSchema = new mongoose.Schema({
  testId: String,
  title: String,
  password: String,
  duration: Number,
  shuffleQuestions: Boolean,
  shuffleOptions: Boolean,
  questions: Array,

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff", // 🔥 REQUIRED FOR populate
    required: true
  }

}, { timestamps: true });

module.exports = mongoose.model("Test", testSchema);
