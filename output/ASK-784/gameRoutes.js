const express = require('express');
const { startGame, makeGuess, endGame } = require('./gameController');

const router = express.Router();

// Game routes
router.post('/start', startGame);
router.post('/guess', makeGuess);
router.post('/end', endGame);

module.exports = router;