const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: String,
      required: true,
      index: true,
    },
    senderPhone: {
      type: String,
      index: true,
    },
    recipientId: {
      type: String,
      required: true,
      index: true,
    },
    recipientPhone: {
      type: String,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    conversationId: {
      type: String,
      index: true,
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'file'],
      default: 'text',
    },
  },
  { timestamps: true }
);

// Create compound index for efficient conversation queries
messageSchema.index({ senderId: 1, recipientId: 1 });
messageSchema.index({ conversationId: 1, timestamp: -1 });
messageSchema.index({ senderPhone: 1, recipientPhone: 1 });

module.exports = mongoose.model('Message', messageSchema);
