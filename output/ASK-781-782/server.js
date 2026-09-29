const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const feedbackRoutes = require('./feedbackRoutes');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/feedback', feedbackRoutes);

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server and connect to the database
app.listen(process.env.PORT || 3000, () => console.log('Server on port ' + (process.env.PORT || 3000)));

// Auto-patched: Express starts immediately; DB connects in background
app.listen(process.env.PORT || 56208, () => console.log('[preview] Server on port ' + (process.env.PORT || 56208)));
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/preview')
  .then(() => console.log('[preview] MongoDB connected'))
  .catch(e => console.warn('[preview] MongoDB unavailable:', e.message));
