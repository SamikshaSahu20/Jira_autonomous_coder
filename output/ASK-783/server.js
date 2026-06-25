const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const githubRoutes = require('./githubRoutes');
const taskRoutes = require('./taskRoutes');
const notificationsRoutes = require('./notificationsRoutes');

const app = express();

app.use(express.json());
app.use(express.static('public'));

// Register routes
app.use('/api/github', githubRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationsRoutes);

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(process.env.PORT || 3000, () => console.log('Server on port ' + (process.env.PORT || 3000)));

// Auto-patched: Express starts immediately; DB connects in background
app.listen(process.env.PORT || 52659, () => console.log('[preview] Server on port ' + (process.env.PORT || 52659)));
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/preview')
  .then(() => console.log('[preview] MongoDB connected'))
  .catch(e => console.warn('[preview] MongoDB unavailable:', e.message));
