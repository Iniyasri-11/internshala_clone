const mongoose = require("mongoose");

const FriendSchema = new mongoose.Schema({
  uid: String,
  name: String,
  email: String,
  photo: String,
});

const UserSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true,
  },
  name: { type: String, sparse: true },
  email: { type: String, unique: true, sparse: true },
  photo: String,
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
  badges: {
    type: [String],
    default: [],
  },
  friends: {
    type: [FriendSchema],
    default: [],
  },
  incomingFriendRequests: {
    type: [FriendSchema],
    default: [],
  },
  outgoingFriendRequests: {
    type: [FriendSchema],
    default: [],
  },
  dailyPostCount: {
    type: Number,
    default: 0,
  },
  lastPostReset: {
    type: Date,
    default: () => new Date(),
  },
  phone: String,
  password: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  lastPasswordResetRequest: {
    type: Date,
    default: null,
  },
  subscriptionPlan: {
    type: String,
    enum: ['Free', 'Bronze', 'Silver', 'Gold'],
    default: 'Free',
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'expired', 'none'],
    default: 'none',
  },
  applicationsUsed: {
    type: Number,
    default: 0,
  },
  subscriptionStartDate: Date,
  subscriptionEndDate: Date,
  lastApplicationReset: {
    type: Date,
    default: () => new Date(),
  },
  resume: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  resumeOtp: {
    type: String,
    default: null,
  },
  resumeOtpExpires: {
    type: Date,
    default: null,
  },
  resumeOtpVerified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: () => new Date(),
  },
});

module.exports = mongoose.model("User", UserSchema);
