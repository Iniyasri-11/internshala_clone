const express = require("express");
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require("../Model/User");
const Notification = require("../Model/Notification");
const auth = require("../middleware/auth");
const LanguageOtp = require("../Model/LanguageOtp");
const LoginHistory = require("../Model/LoginHistory");
const { sendLanguageOTPEmail } = require("../utils/emailService");
const multer = require("multer");
const path = require("path");


const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function generateToken(user) {
  return jwt.sign(
    {
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function postingLimit(friendCount) {
  if (friendCount === 0) return 0;
  if (friendCount === 1) return 1;
  if (friendCount === 2) return 2;
  if (friendCount >= 3 && friendCount <= 10) return friendCount;
  return Infinity;
}

async function createNotification(recipientUid, actor, type, message) {
  const notification = new Notification({ recipientUid, actor, type, message });
  await notification.save();
  return notification;
}

router.post("/sync", async (req, res) => {
  try {
    const userPayload = req.body.user;
    if (!userPayload || !userPayload.uid) {
      return res.status(400).json({ error: "User payload is required." });
    }

    const syncData = {
      uid: userPayload.uid,
      name: userPayload.name || undefined,
      email: userPayload.email || undefined,
      photo: userPayload.photo || undefined,
      role: userPayload.role || "user",
      subscriptionPlan: userPayload.subscriptionPlan || "Free",
      subscriptionStatus: userPayload.subscriptionStatus || "none",
    };

    let user = await User.findOne({ uid: syncData.uid });
    if (!user) {
      user = new User({
        ...syncData,
        createdAt: new Date(),
        lastPostReset: new Date(),
        dailyPostCount: 0,
      });
      await user.save();
    } else {
      Object.keys(syncData).forEach((key) => {
        if (syncData[key] !== undefined) {
          user[key] = syncData[key];
        }
      });
      await user.save();
    }

    const token = generateToken(user);
    const limit = postingLimit((user.friends || []).length);
    return res.json({
      user,
      token,
      limit,
      remaining: limit === Infinity ? Infinity : Math.max(0, limit - (user.dailyPostCount || 0)),
      friendCount: (user.friends || []).length,
    });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      return res.status(409).json({ error: "Duplicate user email detected. Please use a unique account." });
    }
    return res.status(500).json({ error: "Unable to synchronize user." });
  }
});

router.get("/suggestions/:uid", async (req, res) => {
  try {
    const current = await User.findOne({ uid: req.params.uid }).lean();
    const suggestions = await User.find({ uid: { $ne: req.params.uid } })
      .sort({ createdAt: -1 })
      .lean();
    return res.json(
      suggestions.map((user) => ({
        uid: user.uid,
        name: user.name,
        email: user.email,
        photo: user.photo,
        badgeCount: (user.badges || []).length,
        isFriend: current?.friends?.some((friend) => friend.uid === user.uid) || false,
        hasOutgoingRequest: current?.outgoingFriendRequests?.some((entry) => entry.uid === user.uid) || false,
        hasIncomingRequest: current?.incomingFriendRequests?.some((entry) => entry.uid === user.uid) || false,
      }))
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to load suggestions." });
  }
});

router.post("/friend-requests", async (req, res) => {
  try {
    const { uid, friendUid } = req.body;
    if (!uid || !friendUid) {
      return res.status(400).json({ error: "uid and friendUid are required." });
    }
    if (uid === friendUid) {
      return res.status(400).json({ error: "You cannot send a friend request to yourself." });
    }
    const user = await User.findOne({ uid });
    const friend = await User.findOne({ uid: friendUid });
    if (!user || !friend) {
      return res.status(404).json({ error: "User not found." });
    }
    user.incomingFriendRequests = user.incomingFriendRequests || [];
    user.outgoingFriendRequests = user.outgoingFriendRequests || [];
    friend.incomingFriendRequests = friend.incomingFriendRequests || [];
    friend.outgoingFriendRequests = friend.outgoingFriendRequests || [];
    if (user.friends?.some((entry) => entry.uid === friendUid)) {
      return res.status(400).json({ error: "You are already friends." });
    }
    if (user.outgoingFriendRequests.some((entry) => entry.uid === friendUid)) {
      return res.status(400).json({ error: "Friend request already sent." });
    }
    if (user.incomingFriendRequests.some((entry) => entry.uid === friendUid)) {
      return res.status(400).json({ error: "This user already sent you a request." });
    }
    user.outgoingFriendRequests.push({ uid: friend.uid, name: friend.name, email: friend.email, photo: friend.photo });
    friend.incomingFriendRequests.push({ uid: user.uid, name: user.name, email: user.email, photo: user.photo });
    await user.save();
    await friend.save();
    await createNotification(friend.uid, { uid: user.uid, name: user.name, email: user.email, photo: user.photo }, "friend-request", `${user.name} sent you a friend request.`);
    return res.json({ success: true, outgoingCount: user.outgoingFriendRequests.length });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to send friend request." });
  }
});

router.post("/friend-requests/accept", async (req, res) => {
  try {
    const { uid, requesterUid } = req.body;
    if (!uid || !requesterUid) {
      return res.status(400).json({ error: "uid and requesterUid are required." });
    }
    const user = await User.findOne({ uid });
    const requester = await User.findOne({ uid: requesterUid });
    if (!user || !requester) {
      return res.status(404).json({ error: "User not found." });
    }
    user.incomingFriendRequests = user.incomingFriendRequests || [];
    requester.outgoingFriendRequests = requester.outgoingFriendRequests || [];
    const incomingIndex = user.incomingFriendRequests.findIndex((entry) => entry.uid === requesterUid);
    const outgoingIndex = requester.outgoingFriendRequests.findIndex((entry) => entry.uid === uid);
    if (incomingIndex === -1) {
      return res.status(400).json({ error: "No incoming friend request found." });
    }
    user.incomingFriendRequests.splice(incomingIndex, 1);
    if (outgoingIndex !== -1) requester.outgoingFriendRequests.splice(outgoingIndex, 1);
    user.friends = user.friends || [];
    requester.friends = requester.friends || [];
    if (!user.friends.some((entry) => entry.uid === requester.uid)) {
      user.friends.push({ uid: requester.uid, name: requester.name, email: requester.email, photo: requester.photo });
    }
    if (!requester.friends.some((entry) => entry.uid === user.uid)) {
      requester.friends.push({ uid: user.uid, name: user.name, email: user.email, photo: user.photo });
    }
    await user.save();
    await requester.save();
    await createNotification(requester.uid, { uid: user.uid, name: user.name, email: user.email, photo: user.photo }, "friend", `${user.name} accepted your friend request.`);
    const limit = postingLimit((user.friends || []).length);
    return res.json({ success: true, friendCount: user.friends.length, limit });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to accept friend request." });
  }
});

router.post("/friend-requests/reject", async (req, res) => {
  try {
    const { uid, requesterUid } = req.body;
    if (!uid || !requesterUid) {
      return res.status(400).json({ error: "uid and requesterUid are required." });
    }
    const user = await User.findOne({ uid });
    const requester = await User.findOne({ uid: requesterUid });
    if (!user || !requester) {
      return res.status(404).json({ error: "User not found." });
    }
    user.incomingFriendRequests = user.incomingFriendRequests || [];
    requester.outgoingFriendRequests = requester.outgoingFriendRequests || [];
    user.incomingFriendRequests = user.incomingFriendRequests.filter((entry) => entry.uid !== requesterUid);
    requester.outgoingFriendRequests = requester.outgoingFriendRequests.filter((entry) => entry.uid !== uid);
    await user.save();
    await requester.save();
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to reject friend request." });
  }
});

router.post("/friend-requests/cancel", async (req, res) => {
  try {
    const { uid, friendUid } = req.body;
    if (!uid || !friendUid) {
      return res.status(400).json({ error: "uid and friendUid are required." });
    }
    const user = await User.findOne({ uid });
    const friend = await User.findOne({ uid: friendUid });
    if (!user || !friend) {
      return res.status(404).json({ error: "User not found." });
    }
    user.outgoingFriendRequests = user.outgoingFriendRequests || [];
    friend.incomingFriendRequests = friend.incomingFriendRequests || [];
    if (!user.outgoingFriendRequests.some((entry) => entry.uid === friendUid)) {
      return res.status(400).json({ error: "No outgoing request found." });
    }
    user.outgoingFriendRequests = user.outgoingFriendRequests.filter((entry) => entry.uid !== friendUid);
    friend.incomingFriendRequests = friend.incomingFriendRequests.filter((entry) => entry.uid !== uid);
    await user.save();
    await friend.save();
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to cancel friend request." });
  }
});

const handleLimitRequest = async (req, res) => {
  try {
    const uid = req.params.uid;
    const user = await User.findOne({ uid }).lean();
    if (!user) return res.status(404).json({ error: "User not found." });
    const friendCount = (user.friends || []).length;
    const limit = postingLimit(friendCount);
    return res.json({
      friendCount,
      limit,
      remaining: limit === Infinity ? Infinity : Math.max(0, limit - (user.dailyPostCount || 0)),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to get posting limit." });
  }
};

router.get("/requests/:uid", async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid }).lean();
    if (!user) return res.status(404).json({ error: "User not found." });
    return res.json({
      incoming: user.incomingFriendRequests || [],
      outgoing: user.outgoingFriendRequests || [],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to load friend requests." });
  }
});

router.get("/:uid/limit", handleLimitRequest);
router.get("/limit/:uid", handleLimitRequest);

router.get('/profile/:uid', auth, async (req, res) => {
  try {
    const uid = req.params.uid;
    if (req.user?.uid !== uid && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const user = await User.findOne({ uid }).lean();
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json({ user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to load profile.' });
  }
});

// POST /send-lang-otp
router.post("/send-lang-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Generate random 6 digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Upsert the OTP in LanguageOtp collection
    await LanguageOtp.findOneAndUpdate(
      { email: normalizedEmail },
      { otp, expiresAt, createdAt: new Date() },
      { upsert: true, new: true }
    );

    // Find user name if exists
    const user = await User.findOne({ email: normalizedEmail }).lean();
    const name = user ? user.name : "User";

    // Send the email
    const emailResult = await sendLanguageOTPEmail(normalizedEmail, name, otp);

    return res.json({
      success: true,
      message: "OTP sent successfully.",
      simulated: !!emailResult.simulated,
      otp: emailResult.simulated ? otp : undefined
    });
  } catch (error) {
    console.error("Error sending language OTP:", error);
    return res.status(500).json({ error: "Failed to send OTP. Please try again." });
  }
});

// POST /verify-lang-otp
router.post("/verify-lang-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find the latest OTP entry
    const entry = await LanguageOtp.findOne({ email: normalizedEmail });
    if (!entry) {
      return res.status(400).json({ error: "No OTP request found for this email. Please request a new OTP." });
    }

    if (entry.expiresAt < new Date()) {
      return res.status(400).json({ error: "OTP has expired. Please request a new one." });
    }

    if (entry.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP code. Please try again." });
    }

    // Successfully verified! Delete the OTP record
    await LanguageOtp.deleteOne({ _id: entry._id });

    return res.json({
      success: true,
      message: "OTP verified successfully. Language change authorized."
    });
  } catch (error) {
    console.error("Error verifying language OTP:", error);
    return res.status(500).json({ error: "Failed to verify OTP. Please try again." });
  }
});

// GET /login-history
router.get("/login-history", auth, async (req, res) => {
  try {
    const normalizedEmail = req.user.email ? req.user.email.toLowerCase().trim() : "";
    const history = await LoginHistory.find({ email: normalizedEmail })
      .sort({ createdAt: -1 })
      .limit(10);
    return res.json({ history });
  } catch (error) {
    console.error("Error fetching login history:", error);
    return res.status(500).json({ error: "Failed to fetch login history." });
  }
});

// Configure Multer for profile pictures
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;
    const valid = allowed.test(path.extname(file.originalname).toLowerCase());
    if (valid) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed."));
    }
  },
});

// POST /update-photo - Update user profile picture
router.post("/update-photo", auth, upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please upload an image file." });
    }
    const photoUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    const normalizedEmail = req.user.email ? req.user.email.toLowerCase().trim() : "";
    const user = await User.findOneAndUpdate(
      { email: normalizedEmail },
      { photo: photoUrl },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    const safe = user.toObject();
    delete safe.password;
    return res.json({ success: true, user: safe });
  } catch (error) {
    console.error("Error updating profile picture:", error);
    return res.status(500).json({ error: "Failed to update profile picture." });
  }
});

module.exports = router;
