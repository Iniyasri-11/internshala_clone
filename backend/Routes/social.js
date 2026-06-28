const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const Post = require("../Model/Post");
const User = require("../Model/User");
const Notification = require("../Model/Notification");

const parseUser = (payload) => {
  if (!payload) return null;
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch (error) {
      return null;
    }
  }
  return payload;
};

async function ensureSyncedUser(payload) {
  const rawUser = parseUser(payload);
  if (!rawUser || !rawUser.uid) return null;
  return await syncUserProfile(rawUser);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "uploads"));
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\.\-]/g, "");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 60 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|mp4|webm|ogg/;
    const valid = allowed.test(path.extname(file.originalname).toLowerCase());
    if (valid) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video uploads are allowed."));
    }
  },
});

function postingLimit(friendCount) {
  if (friendCount === 0) return 0;
  if (friendCount === 1) return 1;
  if (friendCount === 2) return 2;
  if (friendCount >= 3 && friendCount <= 10) return friendCount;
  return Infinity;
}

function getFriendlyLimitText(limit) {
  if (limit === 0) return "0 posts today";
  if (limit === 1) return "1 post today";
  if (limit === Infinity) return "Unlimited posts";
  return `${limit} posts today`;
}

async function syncUserProfile(userPayload) {
  if (!userPayload || !userPayload.uid) return null;
  const existing = await User.findOneAndUpdate(
    { uid: userPayload.uid },
    {
      $set: {
        name: userPayload.name,
        email: userPayload.email,
        photo: userPayload.photo,
        role: userPayload.role || "user",
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true, new: true }
  );
  return existing;
}

router.post("/posts", upload.array("media", 6), async (req, res) => {
  try {
    const rawUser = parseUser(req.body.user);
    if (!rawUser || !rawUser.uid) {
      return res.status(400).json({ error: "User context is required." });
    }
    const user = await syncUserProfile(rawUser);
    const now = new Date();
    const todayString = now.toISOString().slice(0, 10);
    if (!user.lastPostReset || user.lastPostReset.toISOString().slice(0, 10) !== todayString) {
      user.dailyPostCount = 0;
      user.lastPostReset = now;
    }
    const limit = postingLimit((user.friends || []).length);
    if (limit !== Infinity && user.dailyPostCount >= limit) {
      return res.status(429).json({
        error: "Daily posting limit reached.",
        remaining: 0,
        limit: limit,
      });
    }
    const media = (req.files || []).map((file) => ({
      url: `${req.protocol}://${req.get("host")}/uploads/${file.filename}`,
      type: file.mimetype.startsWith("video") ? "video" : "image",
    }));
    const hashtags = req.body.hashtags
      ? req.body.hashtags.split(",").map((tag) => tag.trim()).filter(Boolean)
      : [];

    const post = new Post({
      author: {
        uid: user.uid,
        name: user.name,
        email: user.email,
        photo: user.photo,
      },
      text: req.body.text || "",
      hashtags,
      media,
    });
    await post.save();
    user.dailyPostCount = (user.dailyPostCount || 0) + 1;
    if (!user.badges?.includes("First Post")) {
      user.badges = [...(user.badges || []), "First Post"];
    }
    await user.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("postCreated", post);
    }

    return res.status(201).json(post);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to create post." });
  }
});

router.get("/posts", async (req, res) => {
  try {
    const sort = req.query.sort === "trending" ? "trending" : "newest";
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(5, parseInt(req.query.limit || "10", 10));
    const allPosts = await Post.find({ status: "approved" }).lean();
    const enriched = allPosts.map((post) => ({
      ...post,
      trendScore:
        (post.likes?.length || 0) * 2 +
        (post.comments?.length || 0) * 3 +
        (post.shareCount || 0) * 4,
    }));
    const sorted = enriched.sort((a, b) => {
      if (sort === "trending") {
        return b.trendScore - a.trendScore || new Date(b.createdAt) - new Date(a.createdAt);
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    const start = (page - 1) * limit;
    const paged = sorted.slice(start, start + limit);
    return res.json({ data: paged, page, limit, total: sorted.length });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to load posts." });
  }
});

router.get("/posts/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found." });
    return res.json(post);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to load post." });
  }
});

router.put("/posts/:id", async (req, res) => {
  try {
    const rawUser = parseUser(req.body.user);
    const text = req.body.text;
    const hashtags = req.body.hashtags || [];
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found." });
    if (!rawUser || rawUser.uid !== post.author.uid) {
      return res.status(403).json({ error: "Only the author can edit this post." });
    }
    post.text = typeof text === "string" ? text : post.text;
    post.hashtags = Array.isArray(hashtags) ? hashtags : post.hashtags;
    await post.save();
    const io = req.app.get("io");
    if (io) io.emit("postUpdated", post);
    return res.json(post);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to update post." });
  }
});

router.delete("/posts/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found." });
    post.status = "removed";
    await post.save();
    const io = req.app.get("io");
    if (io) io.emit("postRemoved", post._id);
    return res.json({ success: true, post });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to remove post." });
  }
});

async function createNotification({ recipientUid, actor, type, message, postId, commentId, req }) {
  if (!recipientUid || !actor || recipientUid === actor.uid) return null;
  const notice = new Notification({ recipientUid, actor, type, message, postId, commentId });
  await notice.save();
  const io = req.app.get("io");
  if (io) io.to(recipientUid).emit("notification", notice);
  return notice;
}

router.post("/posts/:id/like", async (req, res) => {
  try {
    const user = await ensureSyncedUser(req.body.user);
    if (!user) return res.status(400).json({ error: "User context required." });
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found." });
    const existing = post.likes.find((like) => like.uid === user.uid);
    if (existing) {
      post.likes = post.likes.filter((like) => like.uid !== user.uid);
    } else {
      post.likes.push({ uid: user.uid, name: user.name, email: user.email, photo: user.photo });
      await createNotification({
        recipientUid: post.author.uid,
        actor: user,
        type: "like",
        message: `${user.name} liked your post.`,
        postId: post._id.toString(),
        req,
      });
    }
    await post.save();
    const io = req.app.get("io");
    if (io) io.emit("postLiked", { postId: post._id, likeCount: post.likes.length });
    return res.json(await Post.findById(post._id).lean());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to like post." });
  }
});

router.post("/posts/:id/comment", async (req, res) => {
  try {
    const user = await ensureSyncedUser(req.body.user);
    const text = req.body.text;
    const parentId = req.body.parentId || null;
    if (!user) return res.status(400).json({ error: "User context required." });
    if (!text) return res.status(400).json({ error: "Comment text is required." });
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found." });
    const comment = {
      author: { uid: user.uid, name: user.name, email: user.email, photo: user.photo },
      text,
      parentId,
      createdAt: new Date(),
    };
    post.comments.push(comment);
    await post.save();
    const savedComment = post.comments[post.comments.length - 1];
    await createNotification({
      recipientUid: post.author.uid,
      actor: user,
      type: parentId ? "reply" : "comment",
      message: parentId
        ? `${user.name} replied to a comment on your post.`
        : `${user.name} commented on your post.`,
      postId: post._id.toString(),
      commentId: savedComment._id.toString(),
      req,
    });
    const io = req.app.get("io");
    if (io) io.emit("postCommented", { postId: post._id, commentCount: post.comments.length });
    return res.json(await Post.findById(post._id).lean());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to add comment." });
  }
});

// React to a comment (thumbs up / thumbs down)
router.post('/posts/:id/comments/:commentId/react', async (req, res) => {
  try {
    // log minimal input for debugging
    // console.log('React request', { params: req.params, body: { type: req.body.type } });
    const user = await ensureSyncedUser(req.body.user);
    let type = req.body.type;
    if (!user) return res.status(400).json({ error: 'User context required.' });
    if (typeof type !== 'string') type = String(type || '').toLowerCase();
    type = type && type.toLowerCase();
    if (!['up', 'down'].includes(type)) return res.status(400).json({ error: 'Invalid reaction type. Use "up" or "down".' });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found.' });

    // initialize fields if older comments lack them
    try {
      if (typeof comment.upCount !== 'number') comment.upCount = 0;
      if (typeof comment.downCount !== 'number') comment.downCount = 0;
      if (!Array.isArray(comment.reactedBy)) comment.reactedBy = [];
    } catch (initErr) {
      console.error('Failed to init comment reaction fields', initErr);
      comment.upCount = comment.upCount || 0;
      comment.downCount = comment.downCount || 0;
      comment.reactedBy = comment.reactedBy || [];
    }

    const existingIndex = comment.reactedBy.findIndex((r) => r && r.uid === user.uid);
    if (existingIndex !== -1) {
      const existing = comment.reactedBy[existingIndex];
      if (existing && existing.type === type) {
        // undo
        comment.reactedBy.splice(existingIndex, 1);
        if (type === 'up') comment.upCount = Math.max(0, (comment.upCount || 0) - 1);
        else comment.downCount = Math.max(0, (comment.downCount || 0) - 1);
      } else {
        // switch
        if (comment.reactedBy[existingIndex]) comment.reactedBy[existingIndex].type = type;
        if (type === 'up') {
          comment.upCount = (comment.upCount || 0) + 1;
          comment.downCount = Math.max(0, (comment.downCount || 0) - 1);
        } else {
          comment.downCount = (comment.downCount || 0) + 1;
          comment.upCount = Math.max(0, (comment.upCount || 0) - 1);
        }
      }
    } else {
      // new reaction
      comment.reactedBy.push({ uid: user.uid, type });
      if (type === 'up') comment.upCount = (comment.upCount || 0) + 1;
      else comment.downCount = (comment.downCount || 0) + 1;
    }

    await post.save();
    const io = req.app.get('io');
    if (io) io.emit('commentReacted', { postId: post._id, commentId: comment._id, up: comment.upCount, down: comment.downCount });
    return res.json(await Post.findById(post._id).lean());
  } catch (error) {
    console.error('Comment react failed', error && error.stack ? error.stack : error);
    // return helpful server message for debugging
    return res.status(500).json({ error: 'Unable to react to comment.', detail: error?.message || String(error) });
  }
});

router.post("/posts/:id/share", async (req, res) => {
  try {
    const user = await ensureSyncedUser(req.body.user);
    if (!user) return res.status(400).json({ error: "User context required." });
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found." });
    post.shareCount = (post.shareCount || 0) + 1;
    await post.save();
    await createNotification({
      recipientUid: post.author.uid,
      actor: user,
      type: "share",
      message: `${user.name} shared your post.`,
      postId: post._id.toString(),
      req,
    });
    const io = req.app.get("io");
    if (io) io.emit("postShared", { postId: post._id, shareCount: post.shareCount });
    return res.json(await Post.findById(post._id).lean());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to share post." });
  }
});

router.post("/posts/:id/report", async (req, res) => {
  try {
    const user = await ensureSyncedUser(req.body.user);
    const reason = req.body.reason || "Inappropriate content";
    if (!user) return res.status(400).json({ error: "User context required." });
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found." });
    if (!post.reportedBy.some((entry) => entry.uid === user.uid)) {
      post.reportedBy.push({ uid: user.uid, reason });
      post.reportCount = post.reportedBy.length;
      await post.save();
    }
    return res.json({ success: true, reportCount: post.reportCount });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to report post." });
  }
});

router.get("/reported", async (req, res) => {
  try {
    const reported = await Post.find({ reportCount: { $gt: 0 }, status: { $ne: "removed" } }).lean();
    return res.json(reported);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to load reported posts." });
  }
});

router.get("/notifications/:uid", async (req, res) => {
  try {
    const notifications = await Notification.find({ recipientUid: req.params.uid })
      .sort({ createdAt: -1 })
      .lean();
    return res.json(notifications);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to load notifications." });
  }
});

router.patch("/notifications/:id/read", async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ error: "Notification not found." });
    notification.read = true;
    await notification.save();
    return res.json(notification);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to update notification." });
  }
});

module.exports = router;
