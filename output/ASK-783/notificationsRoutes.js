const express = require('express');
const { getNotifications, createNotification } = require('./notificationsController');

const router = express.Router();

router.get('/', getNotifications);
router.post('/', createNotification);

module.exports = router;