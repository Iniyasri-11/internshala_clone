const mongoose = require("mongoose");

const LoginHistorySchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true,
  },
  uid: {
    type: String,
    default: null,
    index: true,
  },
  ipAddress: {
    type: String,
    required: true,
  },
  browser: {
    type: String,
    required: true,
  },
  os: {
    type: String,
    required: true,
  },
  deviceType: {
    type: String,
    enum: ["desktop", "laptop", "mobile"],
    required: true,
  },
  status: {
    type: String,
    enum: ["Success", "Failed", "OTP_Pending"],
    required: true,
  },
  failureReason: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: () => new Date(),
  },
});

module.exports = mongoose.model("LoginHistory", LoginHistorySchema);
