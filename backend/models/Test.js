const mongoose = require("mongoose");

const testSchema = new mongoose.Schema(
  {
    testId: {
      type: String,
      required: true,
      unique: true
    },

    title: {
      type: String,
      required: true
    },

    password: {
      type: String,
      required: true
    },

    duration: {
      type: Number,
      required: true
    },

    shuffleQuestions: Boolean,
    shuffleOptions: Boolean,

    questions: [
  {
    type: {
      type: String,
      enum: ["MCQ", "MSQ", "NAT"],
      default: "MCQ"
    },

    question: String,

    image: {
      type: String, // image URL (optional)
      default: ""
    },

    options: [String], // used for MCQ & MSQ only

    correctIndex: Number, // MCQ only

    correctIndexes: [Number], // MSQ only

    correctValue: Number // NAT only
  }
],

    security: {
      fullscreen: Boolean,
      disableCopyPaste: Boolean,
      autoSubmitOnTabChange: Boolean
    },

    // 🔑 VERY IMPORTANT FLAG
    resultsPublished: {
      type: Boolean,
      default: false
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Test", testSchema);
