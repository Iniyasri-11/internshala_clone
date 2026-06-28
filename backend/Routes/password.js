const express = require('express');
const router = express.Router();
const User = require('../Model/User');
const { generatePassword } = require('../utils/passwordGenerator');
const { sendPasswordResetEmail } = require('../utils/emailService');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

/**
 * POST /api/password/forgot-password
 * Request password reset via email or phone
 */
router.post('/forgot-password', async (req, res) => {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const { email, phone, socketId } = req.body;

  const emitStatus = (status, message, extra = {}) => {
    if (socketId && global.io) {
      global.io.to(socketId).emit('forgot-password-status', {
        status,
        message,
        timestamp: new Date(),
        ...extra
      });
    }
  };

  try {
    emitStatus('checking', 'Finding registered user account...');
    await delay(600);

    if (!email && !phone) {
      emitStatus('error', 'Email or phone number is required');
      return res.status(400).json({ message: 'Email or phone number is required' });
    }

    // Find user by email or phone without matching null fields
    const queryConditions = [];
    if (email) queryConditions.push({ email });
    if (phone) queryConditions.push({ phone });

    const user = await User.findOne({ $or: queryConditions });

    if (!user) {
      emitStatus('error', 'User not found with provided email or phone');
      return res.status(404).json({ message: 'User not found with provided email or phone' });
    }

    if (!user.email) {
      emitStatus('error', 'No registered email found for this account.');
      return res.status(400).json({ message: 'No registered email found for this account. Please contact support or use a registered email.' });
    }

    // Check rate limiting to allow reset requests only once per day (24 hours)
    const now = new Date();
    const lastRequest = user.lastPasswordResetRequest ? new Date(user.lastPasswordResetRequest) : null;
    const RESET_REQUEST_COOLDOWN_HOURS = 24;

    if (lastRequest) {
      const hoursSinceLastRequest = (now - lastRequest) / (1000 * 60 * 60);
      if (hoursSinceLastRequest < RESET_REQUEST_COOLDOWN_HOURS) {
        const minutesRemaining = Math.ceil((RESET_REQUEST_COOLDOWN_HOURS * 60) - (hoursSinceLastRequest * 60));
        emitStatus('error', 'You can use this option only once per day.');
        return res.status(429).json({
          message: 'You can use this option only once per day.',
          retryAfter: minutesRemaining,
        });
      }
    }

    emitStatus('generating', 'Generating secure temporary password and reset token...');
    await delay(600);

    // Generate temporary password
    const temporaryPassword = generatePassword(12);
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    // Generate a unique JWT token for the reset link
    const resetToken = jwt.sign(
      {
        uid: user.uid,
        email: user.email,
        jti: crypto.randomBytes(16).toString('hex'),
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Keep old values in case email fails
    const previousPassword = user.password;
    const previousToken = user.passwordResetToken;
    const previousExpires = user.passwordResetExpires;
    const previousRequestTime = user.lastPasswordResetRequest;

    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    emitStatus('saving', 'Saving reset configurations to user profile...');
    await delay(600);

    // Update user with reset token and password
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = expiresAt;
    user.password = hashedPassword;
    user.lastPasswordResetRequest = now;
    await user.save();

    emitStatus('sending', `Connecting to mail server to dispatch instructions to ${user.email}...`);
    await delay(800);

    // Send email
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;
    const emailResult = await sendPasswordResetEmail(user.email, user.name, resetLink, temporaryPassword, expiresAt);

    if (!emailResult.success) {
      user.password = previousPassword;
      user.passwordResetToken = previousToken;
      user.passwordResetExpires = previousExpires;
      user.lastPasswordResetRequest = previousRequestTime;
      await user.save().catch((err) => console.error('Failed to revert user state after email failure', err));
      
      emitStatus('error', `Failed to send email. ${emailResult.error || 'Please try again.'}`);
      return res.status(500).json({ message: `Failed to send reset email. ${emailResult.error || 'Please try again.'}` });
    }

    emitStatus('sent', 'Password reset email sent successfully. Check your inbox for instructions.', {
      email: user.email,
      resetLink,
      temporaryPassword
    });

    res.status(200).json({
      message: 'Password reset email sent successfully. Check your inbox for instructions.',
      email: user.email,
      simulated: emailResult.simulated,
      resetLink: emailResult.simulated ? resetLink : undefined,
      temporaryPassword: emailResult.simulated ? temporaryPassword : undefined,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    emitStatus('error', 'Server error. Please try again later.');
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

/**
 * POST /api/password/reset-password
 * Reset password using token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired reset token' });
    }

    // Find user
    const user = await User.findOne({ uid: decoded.uid });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify token matches
    if (user.passwordResetToken !== token) {
      return res.status(401).json({ message: 'Invalid reset token' });
    }

    // Check token expiration
    if (new Date() > user.passwordResetExpires) {
      return res.status(401).json({ message: 'Password reset token has expired' });
    }

    // Hash and update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    res.status(200).json({ message: 'Password updated successfully. Please log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

/**
 * GET /api/password/verify-token
 * Verify if reset token is valid
 */
router.get('/verify-token', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ valid: false, message: 'Token is required' });
    }

    // Verify token
    try {
      jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      res.status(200).json({ valid: true });
    } catch (error) {
      res.status(401).json({ valid: false, message: 'Invalid or expired token' });
    }
  } catch (error) {
    res.status(500).json({ valid: false, message: 'Server error' });
  }
});

module.exports = router;
