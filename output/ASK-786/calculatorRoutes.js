const express = require('express');
const { calculate } = require('./calculatorController');

const router = express.Router();

router.post('/calculate', calculate);

module.exports = router;