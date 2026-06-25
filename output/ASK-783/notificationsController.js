const Notification = require('./Notification');

const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ timestamp: -1 });
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error.message);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

const createNotification = async (req, res) => {
  try {
    const { message, type } = req.body;
    if (!message || !type) {
      return res.status(400).json({ error: 'Message and type are required' });
    }
    const notification = new Notification({ message, type, timestamp: new Date() });
    await notification.save();
    res.status(201).json(notification);
  } catch (error) {
    console.error('Error creating notification:', error.message);
    res.status(500).json({ error: 'Failed to create notification' });
  }
};

module.exports = { getNotifications, createNotification };