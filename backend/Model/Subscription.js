const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  planName: {
    type: String,
    enum: ['Free', 'Bronze', 'Silver', 'Gold'],
    required: true,
  },
  price: { type: Number, required: true },
  applicationLimit: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active',
  },
  createdAt: {
    type: Date,
    default: () => new Date(),
  },
});

module.exports = mongoose.model('Subscription', SubscriptionSchema);
