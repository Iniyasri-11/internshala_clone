const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  recipientUid: String,
  actor: {
    uid: String,
    name: String,
    email: String,
    photo: String,
  },
  type: {
    type: String,
    enum: ["like", "comment", "reply", "share", "friend", "friend-request", "limit"],
  },
  message: String,
  postId: String,
  commentId: String,
  read: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Notification", NotificationSchema);
