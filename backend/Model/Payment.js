const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  paymentGateway: { type: String, required: true },
  paymentId: { type: String },
  orderId: { type: String },
  amount: { type: Number, required: true },
  invoiceNumber: { type: String, required: true },
  status: {
    type: String,
    enum: ['created', 'paid', 'failed', 'refunded'],
    default: 'created',
  },
  createdAt: {
    type: Date,
    default: () => new Date(),
  },
});

module.exports = mongoose.model('Payment', PaymentSchema);
