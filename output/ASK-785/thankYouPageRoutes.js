const express = require('express');
const { getThankYouPage } = require('./thankYouPageController');
const router = express.Router();

router.get('/', getThankYouPage);

module.exports = router;