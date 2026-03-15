const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true
  },

  password: {
    type: String,
    required: true
  },

  role: {
    type: String,
    enum: ["admin", "staff"],
    default: "staff"
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  securityQuestion: {
    type: String,
    default: ''
  },

  securityAnswer: {
    type: String,
    default: ''
  }
});

module.exports = mongoose.model("Staff", staffSchema);