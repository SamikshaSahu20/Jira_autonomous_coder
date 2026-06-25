const express = require('express');
const feedbackController = require('./feedbackController');

const router = express.Router();

router.post('/feedback', feedbackController.submitFeedback);

module.exports = router;