const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  numberToGuess: { type: Number, required: true },
  attempts: { type: Number, default: 0 },
  timeTaken: { type: Number, default: 0 },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
}, { timestamps: true });

module.exports = mongoose.model('Game', gameSchema);