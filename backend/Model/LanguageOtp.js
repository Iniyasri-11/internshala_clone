const mongoose = require("mongoose");

const LanguageOtpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true,
  },
  otp: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: () => new Date(),
    index: { expires: '10m' } // TTL index to automatically expire documents after 10 minutes
  }
});

module.exports = mongoose.model("LanguageOtp", LanguageOtpSchema);
