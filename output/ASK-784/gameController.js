const crypto = require('crypto');
const Game = require('./Game');

// Start a new game
exports.startGame = async (req, res) => {
  try {
    const { playerId, difficulty } = req.body;
    const maxNumber = difficulty === 'Easy' ? 10 : difficulty === 'Medium' ? 50 : 100;
    const numberToGuess = crypto.randomInt(1, maxNumber + 1);

    const game = new Game({
      playerId,
      numberToGuess,
      attempts: 0,
      timeTaken: 0,
      difficulty,
    });

    await game.save();
    res.status(201).json({ gameId: game._id, message: 'Game started!', maxNumber });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start game' });
  }
};

// Process a guess
exports.makeGuess = async (req, res) => {
  try {
    const { gameId, guess } = req.body;
    const game = await Game.findById(gameId);

    if (!game) return res.status(404).json({ error: 'Game not found' });

    game.attempts += 1;

    if (guess < game.numberToGuess) {
      res.json({ hint: 'Too Low', attempts: game.attempts });
    } else if (guess > game.numberToGuess) {
      res.json({ hint: 'Too High', attempts: game.attempts });
    } else {
      game.timeTaken = Date.now() - game.createdAt;
      await game.save();
      res.json({ message: 'Correct! You guessed the number!', attempts: game.attempts });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to process guess' });
  }
};

// End the game
exports.endGame = async (req, res) => {
  try {
    const { gameId } = req.body;
    const game = await Game.findById(gameId);

    if (!game) return res.status(404).json({ error: 'Game not found' });

    game.timeTaken = Date.now() - game.createdAt;
    await game.save();

    res.json({ message: 'Game ended', game });
  } catch (error) {
    res.status(500).json({ error: 'Failed to end game' });
  }
};