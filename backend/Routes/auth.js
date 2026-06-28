const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../Model/User');
const LoginHistory = require('../Model/LoginHistory');
const LoginOtp = require('../Model/LoginOtp');
const { parseUserAgent } = require('../utils/uaParser');
const { getISTParts } = require('../utils/timeUtils');
const { sendLoginOTPEmail } = require('../utils/emailService');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function generateToken(user) {
  return jwt.sign(
    {
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

async function logLoginAttempt({ email, uid, ipAddress, browser, os, deviceType, status, failureReason }) {
  try {
    const history = new LoginHistory({
      email,
      uid,
      ipAddress,
      browser,
      os,
      deviceType,
      status,
      failureReason,
    });
    await history.save();
    console.log(`[LoginHistory] Recorded: ${email} | Status: ${status} | Browser: ${browser} | OS: ${os} | Device: ${deviceType} | Reason: ${failureReason || 'None'}`);
  } catch (error) {
    console.error("Error saving login attempt log:", error);
  }
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, photo } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
    const existing = await User.findOne({ $or: [{ email }, { name }] });
    if (existing) {
      if (existing.email === email) return res.status(400).json({ error: 'Email already registered.' });
      return res.status(400).json({ error: 'Username already taken.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const uid = `user-${Date.now()}`;
    const user = new User({ uid, name, email, phone, password: hashed, photo: photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff&size=128` });
    await user.save();
    const safe = user.toObject();
    delete safe.password;
    delete safe.passwordResetToken;
    delete safe.passwordResetExpires;
    const token = generateToken(user);
    return res.json({ user: safe, token });
  } catch (err) {
    console.error(err);
    if (err && err.code === 11000) {
      return res.status(400).json({ error: 'Duplicate field exists.' });
    }
    return res.status(500).json({ error: 'Unable to register user.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, otp } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    // 1. Get Client Environment Details
    const ipAddress = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || '127.0.0.1';
    const cleanIp = ipAddress.startsWith('::ffff:') ? ipAddress.substring(7) : ipAddress;

    const parsedAgent = parseUserAgent(req.headers['user-agent']);
    const browser = req.body.browser || parsedAgent.browser;
    const os = req.body.os || parsedAgent.os;
    const deviceType = req.body.deviceType || parsedAgent.deviceType;

    // 2. Authenticate User Credentials
    const user = await User.findOne({ email });
    if (!user) {
      await logLoginAttempt({
        email,
        uid: null,
        ipAddress: cleanIp,
        browser,
        os,
        deviceType,
        status: "Failed",
        failureReason: "User not found",
      });
      return res.status(404).json({ error: 'User not found.' });
    }

    const ok = await bcrypt.compare(password, user.password || '');
    if (!ok) {
      await logLoginAttempt({
        email,
        uid: user.uid,
        ipAddress: cleanIp,
        browser,
        os,
        deviceType,
        status: "Failed",
        failureReason: "Invalid credentials",
      });
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // 3. Apply Mobile Device Login Constraint (Allowed only between 10:00 AM and 1:00 PM IST)
    if (deviceType === 'mobile') {
      const checkDate = req.body.mockTime ? new Date(req.body.mockTime) : new Date();
      const parts = getISTParts(checkDate);
      const isAllowedTime = parts.hour >= 10 && parts.hour < 13;
      if (!isAllowedTime) {
        await logLoginAttempt({
          email,
          uid: user.uid,
          ipAddress: cleanIp,
          browser,
          os,
          deviceType,
          status: "Failed",
          failureReason: "Mobile login blocked outside 10:00 AM - 1:00 PM IST",
        });
        return res.status(403).json({ error: "Mobile logins are only allowed between 10:00 AM and 1:00 PM IST." });
      }
    }

    // 4. Apply Google Chrome Login OTP Verification Constraint
    if (browser === 'Google Chrome') {
      if (!otp) {
        // Send OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await LoginOtp.findOneAndUpdate(
          { email },
          { otp: otpCode, expiresAt, createdAt: new Date() },
          { upsert: true, new: true }
        );

        const emailResult = await sendLoginOTPEmail(email, user.name || 'User', otpCode);

        await logLoginAttempt({
          email,
          uid: user.uid,
          ipAddress: cleanIp,
          browser,
          os,
          deviceType,
          status: "OTP_Pending",
          failureReason: "Google Chrome login waiting for OTP",
        });

        return res.json({
          requiresOtp: true,
          email,
          simulated: !!emailResult.simulated,
          otp: emailResult.simulated ? otpCode : undefined
        });
      } else {
        // Verify OTP
        const entry = await LoginOtp.findOne({ email });
        if (!entry) {
          await logLoginAttempt({
            email,
            uid: user.uid,
            ipAddress: cleanIp,
            browser,
            os,
            deviceType,
            status: "Failed",
            failureReason: "No OTP request found for this login session",
          });
          return res.status(400).json({ error: "No OTP verification request found. Please login again." });
        }

        if (entry.expiresAt < new Date()) {
          await logLoginAttempt({
            email,
            uid: user.uid,
            ipAddress: cleanIp,
            browser,
            os,
            deviceType,
            status: "Failed",
            failureReason: "OTP expired",
          });
          return res.status(400).json({ error: "OTP has expired. Please request a new one." });
        }

        if (entry.otp !== otp) {
          await logLoginAttempt({
            email,
            uid: user.uid,
            ipAddress: cleanIp,
            browser,
            os,
            deviceType,
            status: "Failed",
            failureReason: "Invalid OTP code",
          });
          return res.status(400).json({ error: "Invalid OTP code. Please try again." });
        }

        // Successfully verified! Clear the OTP
        await LoginOtp.deleteOne({ _id: entry._id });
      }
    }

    // 5. Successful Login Authorization
    await logLoginAttempt({
      email,
      uid: user.uid,
      ipAddress: cleanIp,
      browser,
      os,
      deviceType,
      status: "Success",
    });

    const safe = user.toObject();
    delete safe.password;
    const token = generateToken(user);
    return res.json({ user: safe, token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to login.' });
  }
});

module.exports = router;
