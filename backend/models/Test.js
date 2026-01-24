const mongoose = require("mongoose");

const testSchema = new mongoose.Schema({
  testId: String,
  title: String,
  password: String,
  duration: Number,
  shuffleQuestions: Boolean,
  shuffleOptions: Boolean,
  questions: Array,

  security: {
    fullscreen: Boolean,
    disableCopyPaste: Boolean,
    autoSubmitOnTabChange: Boolean
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff",
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model("Test", testSchema);
