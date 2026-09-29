const express = require('express');
const path = require('path');
const newsRoutes = require('./newsRoutes');

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/news', newsRoutes);

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(process.env.PORT || 3000, () => {
  console.log('Server on port ' + (process.env.PORT || 3000));
});

// Fire-and-forget DB connection
const mongoose = require('mongoose');

// Auto-patched: Express starts immediately; DB connects in background
app.listen(process.env.PORT || 57503, () => console.log('[preview] Server on port ' + (process.env.PORT || 57503)));
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/preview')
  .then(() => console.log('[preview] MongoDB connected'))
  .catch(e => console.warn('[preview] MongoDB unavailable:', e.message));
