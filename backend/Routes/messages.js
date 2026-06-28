const express = require('express');
const router = express.Router();
const Message = require('../Model/Message');
const User = require('../Model/User');

// Search user by phone or email
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;

    const user = await User.findOne({
      $or: [
        { phone: query },
        { email: query.toLowerCase() },
        { name: { $regex: query, $options: 'i' } },
      ],
    }).select('uid phone email name photo');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error searching user:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get conversation list with latest message for each conversation
router.get('/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findOne({ uid: userId }).select('phone');

    const messages = await Message.find({
      $or: [
        { senderId: userId },
        { recipientId: userId },
        { senderPhone: user?.phone },
        { recipientPhone: user?.phone },
      ],
    })
      .sort({ timestamp: -1 })
      .select('senderId recipientId senderPhone recipientPhone content timestamp read')
      .lean();

    // Group by conversation partner
    const conversationMap = new Map();

    for (const msg of messages) {
      const partnerId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      const partnerPhone = msg.senderPhone === user?.phone ? msg.recipientPhone : msg.senderPhone;

      if (!conversationMap.has(partnerId || partnerPhone)) {
        const key = partnerId || partnerPhone;
        const partnerUser = await User.findOne({
          $or: [{ uid: partnerId }, { phone: partnerPhone }],
        }).select('name email photo uid phone');

        conversationMap.set(key, {
          partnerId: partnerUser?.uid,
          partnerPhone: partnerUser?.phone,
          partnerName: partnerUser?.name || 'Unknown User',
          partnerEmail: partnerUser?.email,
          partnerPhoto: partnerUser?.photo,
          lastMessage: msg.content,
          lastMessageTime: msg.timestamp,
          unreadCount: 0,
        });
      }

      const key = partnerId || partnerPhone;
      const conv = conversationMap.get(key);
      if (
        (msg.recipientId === userId || msg.recipientPhone === user?.phone) &&
        !msg.read
      ) {
        conv.unreadCount += 1;
      }
    }

    const conversations = Array.from(conversationMap.values()).sort(
      (a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
    );

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get messages between two users (by UID or phone)
router.get('/conversation/:userId/:partnerId', async (req, res) => {
  try {
    const { userId, partnerId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;

    const user = await User.findOne({ uid: userId }).select('phone');
    const partner = await User.findOne({
      $or: [{ uid: partnerId }, { phone: partnerId }],
    }).select('uid phone');

    const messages = await Message.find({
      $or: [
        { senderId: userId, recipientId: partner?.uid },
        { senderId: partner?.uid, recipientId: userId },
        { senderPhone: user?.phone, recipientPhone: partner?.phone },
        { senderPhone: partner?.phone, recipientPhone: user?.phone },
      ],
    })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Mark messages as read
    await Message.updateMany(
      {
        $or: [
          { senderId: partner?.uid, recipientId: userId, read: false },
          { senderPhone: partner?.phone, recipientPhone: user?.phone, read: false },
        ],
      },
      { read: true }
    );

    res.json(messages.reverse());
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a message (supports both UID and phone)
router.post('/send', async (req, res) => {
  try {
    const { senderId, recipientId, content, senderPhone, recipientPhone } = req.body;

    if (!senderId && !senderPhone) {
      return res.status(400).json({ error: 'Sender ID or phone required' });
    }

    if (!recipientId && !recipientPhone) {
      return res.status(400).json({ error: 'Recipient ID or phone required' });
    }

    if (!content) {
      return res.status(400).json({ error: 'Message content required' });
    }

    const conversationId = [senderId || senderPhone, recipientId || recipientPhone]
      .filter(Boolean)
      .sort()
      .join('-');

    const message = new Message({
      senderId,
      recipientId,
      senderPhone,
      recipientPhone,
      content,
      conversationId,
    });

    await message.save();

    // Emit socket event for real-time delivery
    const appIo = global.io;
    if (appIo) {
      const recipient = await User.findOne({
        $or: [{ uid: recipientId }, { phone: recipientPhone }],
      }).select('uid name photo');

      if (recipient) {
        appIo.to(recipient.uid).emit('message', {
          ...message.toObject(),
          senderName: (await User.findOne({
            $or: [{ uid: senderId }, { phone: senderPhone }],
          }).select('name photo')).name,
        });
      }
    }

    res.json({ success: true, message });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get unread message count
router.get('/unread-count/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findOne({ uid: userId }).select('phone');

    const unreadCount = await Message.countDocuments({
      $or: [
        { recipientId: userId, read: false },
        { recipientPhone: user?.phone, read: false },
      ],
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Delete a message
router.delete('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.senderId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Message.findByIdAndDelete(messageId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;
