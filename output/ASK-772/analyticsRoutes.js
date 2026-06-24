const express = require('express');
const { getAnalytics } = require('../controllers/analyticsController');
const { authenticateUser } = require('../controllers/authController');

const router = express.Router();

router.get('/analytics', authenticateUser, getAnalytics);

module.exports = router;