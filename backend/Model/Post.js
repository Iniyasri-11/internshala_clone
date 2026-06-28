const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({
  author: {
    uid: String,
    name: String,
    email: String,
    photo: String,
  },
  text: String,
  parentId: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  upCount: {
    type: Number,
    default: 0,
  },
  downCount: {
    type: Number,
    default: 0,
  },
  reactedBy: [
    {
      uid: String,
      type: String, // 'up' or 'down'
    },
  ],
});

const MediaSchema = new mongoose.Schema({
  url: String,
  type: String,
});

const PostSchema = new mongoose.Schema({
  author: {
    uid: String,
    name: String,
    email: String,
    photo: String,
  },
  text: String,
  hashtags: [String],
  media: [MediaSchema],
  likes: [
    {
      uid: String,
      name: String,
      email: String,
      photo: String,
    },
  ],
  comments: [CommentSchema],
  shareCount: {
    type: Number,
    default: 0,
  },
  reportCount: {
    type: Number,
    default: 0,
  },
  reportedBy: [
    {
      uid: String,
      reason: String,
    },
  ],
  status: {
    type: String,
    enum: ["approved", "pending", "removed"],
    default: "approved",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Post", PostSchema);
