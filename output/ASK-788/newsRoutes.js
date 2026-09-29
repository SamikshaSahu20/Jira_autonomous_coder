const express = require('express');
const router = express.Router();
const newsController = require('./newsController');

// Routes
router.get('/', newsController.getAllNews);
router.get('/:category', newsController.getNewsByCategory);
router.get('/search/:query', newsController.searchNews);

module.exports = router;