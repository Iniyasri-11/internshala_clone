const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const adminAuth = require("../middleware/adminAuth");
const User = require("../Model/User");
const Subscription = require("../Model/Subscription");
const Payment = require("../Model/Payment");
const Application = require("../Model/Application");
const LoginHistory = require("../Model/LoginHistory");
const LoginOtp = require("../Model/LoginOtp");
const { parseUserAgent } = require("../utils/uaParser");
const { getISTParts } = require("../utils/timeUtils");
const { sendLoginOTPEmail } = require("../utils/emailService");

const adminuser = "admin";
const adminpass = "admin";

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

router.post("/adminlogin", async (req, res) => {
  try {
    const { username, password, otp } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });

    // 1. Get Client Environment Details
    const ipAddress = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || '127.0.0.1';
    const cleanIp = ipAddress.startsWith('::ffff:') ? ipAddress.substring(7) : ipAddress;

    const parsedAgent = parseUserAgent(req.headers['user-agent']);
    const browser = req.body.browser || parsedAgent.browser;
    const os = req.body.os || parsedAgent.os;
    const deviceType = req.body.deviceType || parsedAgent.deviceType;

    const adminEmail = 'admin@internshala-clone.com';

    async function logAdminAttempt(status, failureReason) {
      try {
        const history = new LoginHistory({
          email: adminEmail,
          uid: 'admin-system-uid',
          ipAddress: cleanIp,
          browser,
          os,
          deviceType,
          status,
          failureReason,
        });
        await history.save();
        console.log(`[LoginHistory-Admin] Recorded: ${adminEmail} | Status: ${status} | Browser: ${browser} | OS: ${os} | Device: ${deviceType} | Reason: ${failureReason || 'None'}`);
      } catch (error) {
        console.error("Error saving admin login attempt log:", error);
      }
    }

    // 2. Authenticate Admin Credentials
    if (username !== adminuser || password !== adminpass) {
      await logAdminAttempt("Failed", "Invalid admin credentials");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 3. Apply Mobile Device Login Constraint (Allowed only between 10:00 AM and 1:00 PM IST)
    if (deviceType === 'mobile') {
      const checkDate = req.body.mockTime ? new Date(req.body.mockTime) : new Date();
      const parts = getISTParts(checkDate);
      const isAllowedTime = parts.hour >= 10 && parts.hour < 13;
      if (!isAllowedTime) {
        await logAdminAttempt("Failed", "Mobile login blocked outside 10:00 AM - 1:00 PM IST");
        return res.status(403).json({ error: "Mobile logins are only allowed between 10:00 AM and 1:00 PM IST." });
      }
    }

    // Ensure Admin user object exists in DB
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      admin = new User({
        uid: 'admin-system-uid',
        name: 'System Admin',
        email: adminEmail,
        role: 'admin',
        subscriptionPlan: 'Gold',
        subscriptionStatus: 'active',
      });
      await admin.save();
    }

    // 4. Apply Google Chrome Login OTP Verification Constraint
    if (browser === 'Google Chrome') {
      if (!otp) {
        // Send OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await LoginOtp.findOneAndUpdate(
          { email: adminEmail },
          { otp: otpCode, expiresAt, createdAt: new Date() },
          { upsert: true, new: true }
        );

        const emailResult = await sendLoginOTPEmail(adminEmail, 'System Admin', otpCode);

        await logAdminAttempt("OTP_Pending", "Google Chrome login waiting for OTP");

        return res.json({
          requiresOtp: true,
          email: adminEmail,
          simulated: !!emailResult.simulated,
          otp: emailResult.simulated ? otpCode : undefined
        });
      } else {
        // Verify OTP
        const entry = await LoginOtp.findOne({ email: adminEmail });
        if (!entry) {
          await logAdminAttempt("Failed", "No OTP request found for this login session");
          return res.status(400).json({ error: "No OTP verification request found. Please login again." });
        }

        if (entry.expiresAt < new Date()) {
          await logAdminAttempt("Failed", "OTP expired");
          return res.status(400).json({ error: "OTP has expired. Please request a new one." });
        }

        if (entry.otp !== otp) {
          await logAdminAttempt("Failed", "Invalid OTP code");
          return res.status(400).json({ error: "Invalid OTP code. Please try again." });
        }

        // Successfully verified! Clear the OTP
        await LoginOtp.deleteOne({ _id: entry._id });
      }
    }

    // 5. Successful Admin Authorization
    await logAdminAttempt("Success");

    const token = jwt.sign(
      {
        uid: admin.uid,
        email: admin.email,
        name: admin.name,
        role: 'admin',
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      message: "admin is here",
      token,
      user: {
        uid: admin.uid,
        name: admin.name,
        email: admin.email,
        role: 'admin',
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to login.' });
  }
});

router.get('/overview', adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeSubscriptions = await Subscription.countDocuments({ status: 'active' });
    const expiredSubscriptions = await Subscription.countDocuments({ status: 'expired' });
    const totalPayments = await Payment.countDocuments();
    const totalApplications = await Application.countDocuments();
    const monthlyApplications = await Application.countDocuments({
      createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
    });

    return res.json({
      totalUsers,
      activeSubscriptions,
      expiredSubscriptions,
      totalPayments,
      totalApplications,
      monthlyApplications,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to load admin overview.' });
  }
});

router.get('/subscriptions', adminAuth, async (req, res) => {
  try {
    const subscriptions = await Subscription.find().sort({ createdAt: -1 }).lean();
    return res.json({ subscriptions });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to load subscription list.' });
  }
});

router.get('/payments', adminAuth, async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 }).lean();
    return res.json({ payments });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to load payments.' });
  }
});

router.post('/subscription/adjust', adminAuth, async (req, res) => {
  try {
    const { uid, planName } = req.body;
    if (!uid || !planName) {
      return res.status(400).json({ error: 'uid and planName are required.' });
    }
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const planPrices = { Free: 0, Bronze: 100, Silver: 300, Gold: 1000 };
    const planLimits = { Free: 1, Bronze: 3, Silver: 5, Gold: Infinity };
    if (!planPrices.hasOwnProperty(planName)) {
      return res.status(400).json({ error: 'Invalid plan.' });
    }
    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    user.subscriptionPlan = planName;
    user.subscriptionStatus = 'active';
    user.subscriptionStartDate = now;
    user.subscriptionEndDate = endDate;
    user.applicationsUsed = 0;
    await user.save();

    const subscription = new Subscription({
      userId: user.uid,
      planName,
      price: planPrices[planName],
      applicationLimit: planLimits[planName] === Infinity ? 0 : planLimits[planName],
      startDate: now,
      endDate,
      status: 'active',
    });
    await subscription.save();

    return res.json({ success: true, user, subscription });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to adjust subscription.' });
  }
});

router.post('/payments/refund', adminAuth, async (req, res) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'paymentId is required.' });
    const payment = await Payment.findOne({ paymentId });
    if (!payment) return res.status(404).json({ error: 'Payment not found.' });
    payment.status = 'refunded';
    await payment.save();
    return res.json({ success: true, payment });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to mark payment refunded.' });
  }
});

module.exports = router;
