const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const gameRoutes = require('./gameRoutes');
const leaderboardRoutes = require('./leaderboardRoutes');
const settingsRoutes = require('./settingsRoutes');
const notificationsRoutes = require('./notificationsRoutes');
const analyticsRoutes = require('./analyticsRoutes');

const app = express();

// Middleware
app.use(helmet());
app.use(express.json());
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Routes
app.use('/game', gameRoutes);
app.use('/leaderboard', leaderboardRoutes);
app.use('/settings', settingsRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/analytics', analyticsRoutes);

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Start server and connect to MongoDB
app.listen(process.env.PORT || 3000, () => console.log('Server on port ' + (process.env.PORT || 3000)));

// Auto-patched: Express starts immediately; DB connects in background
app.listen(process.env.PORT || 58712, () => console.log('[preview] Server on port ' + (process.env.PORT || 58712)));
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/preview')
  .then(() => console.log('[preview] MongoDB connected'))
  .catch(e => console.warn('[preview] MongoDB unavailable:', e.message));
