const express = require('express');
const { getWeatherData } = require('./weatherController');

const router = express.Router();

router.get('/', getWeatherData);

module.exports = router;