const mongoose = require("mongoose");

const testSchema = new mongoose.Schema(
  {
    testId: { type: String, required: true, unique: true },
    title:  { type: String, required: true },
    password: { type: String, required: true },
    duration: { type: Number, required: true },
    shuffleQuestions: Boolean,
    shuffleOptions: Boolean,

    // Schedule window (optional)
    scheduledStart: { type: Date, default: null },
    scheduledEnd:   { type: Date, default: null },

    // Minimum minutes before student can submit (optional)
    submitAfterMinutes: { type: Number, default: null },

    questions: [
      {
        type: { type: String, enum: ["MCQ", "MSQ", "NAT"], default: "MCQ" },
        question: String,
        image:    { type: String, default: "" },
        options:  [String],
        correctIndex:   Number,
        correctIndexes: [Number],
        correctValue:   Number,
        marks:          { type: Number, default: 1 },
        negativeMarkingEnabled: { type: Boolean, default: false },
        negativeMarks:  { type: Number, default: 0 },
        explanation:    { type: String, default: "" }
      }
    ],

    security: {
      fullscreen: Boolean,
      disableCopyPaste: Boolean,
      autoSubmitOnTabChange: Boolean
    },

    resultsPublished: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Test", testSchema);