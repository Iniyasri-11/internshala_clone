const mongoose = require("mongoose");
const Applicationipschema = new mongoose.Schema({
  company: String,
  category: String,
  coverLetter: String,
  availability: String,
  user: Object,
  userId: String,
  internshipId: String,
  appliedAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["accepted", "pending", "rejected"],
    default: "pending",
  },
  Application: Object,
});
module.exports = mongoose.model("Application", Applicationipschema);
