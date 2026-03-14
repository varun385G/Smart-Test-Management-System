const mongoose = require('mongoose');

const questionBankSchema = new mongoose.Schema({
  subject:  { type: String, default: 'General' },
  topic:    { type: String, default: '' },
  type:     { type: String, enum: ['MCQ', 'MSQ', 'NAT'], default: 'MCQ' },
  question: { type: String, required: true },
  image:    { type: String, default: '' },
  options:  [String],
  correctIndex:   Number,
  correctIndexes: [Number],
  correctValue:   Number,
  marks:          { type: Number, default: 1 },
  negativeMarkingEnabled: { type: Boolean, default: false },
  negativeMarks:  { type: Number, default: 0 },
  explanation:    { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }
}, { timestamps: true });

module.exports = mongoose.model('QuestionBank', questionBankSchema);