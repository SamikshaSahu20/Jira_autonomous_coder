const express = require('express');
const { submitFeedback } = require('./feedbackController');

const router = express.Router();

router.post('/', submitFeedback);

module.exports = router;