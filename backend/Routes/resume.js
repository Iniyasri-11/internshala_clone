const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../Model/User');
const Payment = require('../Model/Payment');
const auth = require('../middleware/auth');
const { sendOTPEmail } = require('../utils/emailService');

const razorpayConfig = {
  key_id: process.env.RAZORPAY_KEY_ID || null,
  key_secret: process.env.RAZORPAY_KEY_SECRET || null,
};

const razorpay = razorpayConfig.key_id && razorpayConfig.key_secret &&
  !razorpayConfig.key_id.includes('placeholder') && !razorpayConfig.key_secret.includes('placeholder')
  ? new Razorpay(razorpayConfig)
  : null;

// Helper to check if a user has an active premium subscription
function isPremium(user) {
  if (!user || user.subscriptionStatus !== 'active') return false;
  if (user.subscriptionPlan === 'Free') return false;
  if (!user.subscriptionStartDate || !user.subscriptionEndDate) return false;
  const now = new Date();
  const endDate = new Date(user.subscriptionEndDate);
  return endDate >= now;
}

// 1. Send OTP for verification
router.post('/send-otp', auth, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (!isPremium(user)) {
      return res.status(403).json({
        error: 'Resume creation is only available under the premium plan (Bronze, Silver, or Gold). Please upgrade your subscription.'
      });
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resumeOtp = otp;
    user.resumeOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    user.resumeOtpVerified = false;
    await user.save();

    const emailResult = await sendOTPEmail(user.email, user.name, otp);

    return res.json({ 
      success: true, 
      message: 'OTP sent successfully to your registered email.',
      simulated: !!(emailResult && emailResult.simulated) || process.env.TEST_EMAIL_MODE === 'true',
      otp: ((emailResult && emailResult.simulated) || process.env.TEST_EMAIL_MODE === 'true') ? otp : undefined
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to send verification OTP.' });
  }
});

// 2. Verify OTP
router.post('/verify-otp', auth, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: 'OTP is required.' });

    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (!isPremium(user)) {
      return res.status(403).json({ error: 'Premium subscription required.' });
    }

    if (!user.resumeOtp || user.resumeOtp !== otp || new Date() > new Date(user.resumeOtpExpires)) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    user.resumeOtpVerified = true;
    await user.save();

    return res.json({ success: true, message: 'OTP verified successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to verify OTP.' });
  }
});

// 3. Create payment order for ₹50
router.post('/create-order', auth, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (!isPremium(user)) {
      return res.status(403).json({ error: 'Premium subscription required.' });
    }

    if (!user.resumeOtpVerified) {
      return res.status(403).json({ error: 'OTP verification is required before initiating payment.' });
    }

    const invoiceNumber = `INV-RES-${Date.now()}`;
    const amount = 50; // ₹50
    const orderOptions = {
      amount: amount * 100, // in paise
      currency: 'INR',
      receipt: invoiceNumber,
      payment_capture: 1,
    };

    let order;
    if (razorpay) {
      order = await razorpay.orders.create(orderOptions);
    } else {
      console.warn('⚠️ Using sandbox mock order ID for resume checkout.');
      order = {
        id: `order_mock_res_${Date.now()}`,
        currency: 'INR',
      };
    }

    const payment = new Payment({
      userId: user.uid,
      paymentGateway: 'razorpay',
      paymentId: '',
      orderId: order.id,
      amount,
      invoiceNumber,
      status: 'created',
    });
    await payment.save();

    return res.json({
      orderId: order.id,
      amount,
      currency: order.currency,
      invoiceNumber,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_key',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to initiate payment order.' });
  }
});

// 4. Verify payment and save resume data
router.post('/verify-payment', auth, async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, resumeData } = req.body;
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !resumeData) {
      return res.status(400).json({ error: 'Payment and resume verification data are required.' });
    }

    const payment = await Payment.findOne({ orderId: razorpay_order_id, userId: req.user.uid });
    if (!payment) return res.status(404).json({ error: 'Payment record not found.' });

    const expectedSignature = razorpay_order_id.startsWith('order_mock_res_')
      ? razorpay_signature
      : crypto
          .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
          .update(`${razorpay_order_id}|${razorpay_payment_id}`)
          .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      payment.status = 'failed';
      await payment.save();
      return res.status(400).json({ error: 'Payment signature verification failed.' });
    }

    payment.paymentId = razorpay_payment_id;
    payment.status = 'paid';
    await payment.save();

    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.resume = resumeData;
    user.resumeOtpVerified = false; // Reset verification state
    await user.save();

    return res.json({ success: true, user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to verify payment and attach resume.' });
  }
});

module.exports = router;
