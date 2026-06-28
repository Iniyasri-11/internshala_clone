const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../Model/User');
const Subscription = require('../Model/Subscription');
const Payment = require('../Model/Payment');
const auth = require('../middleware/auth');
const { getISTDate, startOfMonth, startOfNextMonth, isPaymentWindow } = require('../utils/timeUtils');
const { sendSubscriptionEmail } = require('../utils/emailService');
const { checkAndResetMonthlyApplications } = require('../utils/resetHelper');

const razorpayConfig = {
  key_id: process.env.RAZORPAY_KEY_ID || null,
  key_secret: process.env.RAZORPAY_KEY_SECRET || null,
};

const razorpay = razorpayConfig.key_id && razorpayConfig.key_secret &&
  !razorpayConfig.key_id.includes('placeholder') && !razorpayConfig.key_secret.includes('placeholder')
  ? new Razorpay(razorpayConfig)
  : null;

const plans = {
  Free: { planName: 'Free', price: 0, applicationLimit: 1 },
  Bronze: { planName: 'Bronze', price: 100, applicationLimit: 3 },
  Silver: { planName: 'Silver', price: 300, applicationLimit: 5 },
  Gold: { planName: 'Gold', price: 1000, applicationLimit: Infinity },
};

function getPlan(planName) {
  return plans[planName] || plans.Free;
}

function getActiveUserPlan(user) {
  const now = getISTDate();
  if (!user || user.subscriptionStatus !== 'active') return plans.Free;
  if (!user.subscriptionStartDate || !user.subscriptionEndDate) return plans.Free;
  const endDate = new Date(user.subscriptionEndDate);
  if (endDate < now) return plans.Free;
  return getPlan(user.subscriptionPlan);
}

function normalizeAmount(price) {
  return Math.round(price * 100);
}

router.get('/plans', async (req, res) => {
  return res.json(Object.values(plans));
});

function getApplicationCountStartDate(user) {
  if (user && user.subscriptionStatus === 'active' && user.subscriptionStartDate) {
    return new Date(user.subscriptionStartDate);
  }
  return startOfMonth(getISTDate());
}

router.get('/summary', auth, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    await checkAndResetMonthlyApplications(user);

    const countStart = getApplicationCountStartDate(user);
    const used = await require('../Model/Application').countDocuments({ userId: user.uid, createdAt: { $gte: countStart } });

    const plan = getActiveUserPlan(user);
    const remaining = plan.applicationLimit === Infinity ? Infinity : Math.max(0, plan.applicationLimit - used);

    return res.json({
      planName: plan.planName,
      price: plan.price,
      applicationLimit: plan.applicationLimit,
      applicationsUsed: used,
      applicationsRemaining: remaining,
      subscriptionStartDate: user.subscriptionStartDate,
      subscriptionEndDate: user.subscriptionEndDate,
      subscriptionStatus: user.subscriptionStatus,
      user,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to load subscription summary.' });
  }
});

router.post('/create-order', auth, async (req, res) => {
  try {
    if (!isPaymentWindow()) {
      return res.status(403).json({ error: 'Payments are only allowed between 10:00 AM and 11:00 AM IST.' });
    }
    const { planName } = req.body;
    if (!planName || !plans[planName]) {
      return res.status(400).json({ error: 'Invalid plan selected.' });
    }
    const plan = getPlan(planName);
    if (plan.price <= 0) {
      return res.status(400).json({ error: 'Free plan does not require payment.' });
    }

    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    await checkAndResetMonthlyApplications(user);

    const invoiceNumber = `INV-${Date.now()}`;
    const orderOptions = {
      amount: normalizeAmount(plan.price),
      currency: 'INR',
      receipt: invoiceNumber,
      payment_capture: 1,
    };

    let order;
    if (razorpay) {
      order = await razorpay.orders.create(orderOptions);
    } else {
      console.warn('⚠️ Razorpay keys are not configured. Generating a simulated/mock order ID for development testing.');
      order = {
        id: `order_mock_${Date.now()}`,
        currency: 'INR',
      };
    }

    const payment = new Payment({
      userId: req.user.uid,
      paymentGateway: 'razorpay',
      paymentId: '',
      orderId: order.id,
      amount: plan.price,
      invoiceNumber,
      status: 'created',
    });
    await payment.save();

    return res.json({
      orderId: order.id,
      amount: plan.price,
      currency: order.currency,
      invoiceNumber,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_key',
      planName,
      description: `${planName} plan subscription charge`,
      name: 'Internshala Clone',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to create payment order.' });
  }
});

router.post('/verify-payment', auth, async (req, res) => {
  try {
    if (!isPaymentWindow()) {
      return res.status(403).json({ error: 'Payments are only allowed between 10:00 AM and 11:00 AM IST.' });
    }
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, planName } = req.body;
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !planName) {
      return res.status(400).json({ error: 'Payment verification data is required.' });
    }

    const payment = await Payment.findOne({ orderId: razorpay_order_id, userId: req.user.uid });
    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found.' });
    }

    const expectedSignature = razorpay_order_id.startsWith('order_mock_')
      ? razorpay_signature
      : crypto
          .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
          .update(`${razorpay_order_id}|${razorpay_payment_id}`)
          .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      payment.status = 'failed';
      await payment.save();
      return res.status(400).json({ error: 'Payment verification failed.' });
    }

    payment.paymentId = razorpay_payment_id;
    payment.status = 'paid';
    await payment.save();

    const user = await User.findOne({ uid: req.user.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const now = getISTDate();
    const startDate = now;
    const endDate = startOfNextMonth(now);
    const plan = getPlan(planName);

    const subscription = new Subscription({
      userId: user.uid,
      planName: plan.planName,
      price: plan.price,
      applicationLimit: plan.applicationLimit === Infinity ? 0 : plan.applicationLimit,
      startDate,
      endDate,
      status: 'active',
    });
    await subscription.save();

    user.subscriptionPlan = plan.planName;
    user.subscriptionStatus = 'active';
    user.subscriptionStartDate = startDate;
    user.subscriptionEndDate = endDate;
    user.applicationsUsed = 0;
    await user.save();

    await sendSubscriptionEmail(user.email, user.name, {
      planName: plan.planName,
      price: plan.price,
      invoiceNumber: payment.invoiceNumber,
      paymentId: payment.paymentId,
      transactionDate: payment.createdAt,
      expiryDate: endDate,
    });

    return res.json({
      success: true,
      subscription: {
        planName: plan.planName,
        price: plan.price,
        applicationLimit: plan.applicationLimit,
        startDate,
        endDate,
        status: 'active',
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to verify payment.' });
  }
});

router.get('/history', auth, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.uid }).sort({ createdAt: -1 }).lean();
    return res.json({ payments });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to load payment history.' });
  }
});

module.exports = router;
