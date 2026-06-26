const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { validateEnv } = require('./validationMiddleware');
const errorHandler = require('./errorHandler');
const thankYouPageRoutes = require('./thankYouPageRoutes');

dotenv.config();
validateEnv();

const app = express();

// Middleware
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/api/thank-you', thankYouPageRoutes);

// Serve the main page
app.get('/', (req, res, next) => {
  try {
    res.sendFile(path.join(__dirname, 'index.html'));
  } catch (err) {
    next(err);
  }
});

// 404 Error Handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Resource not found' });
});

// Global Error Handler
app.use(errorHandler);

// Start the server
app.listen(process.env.PORT || 3000, () => {
  console.log('Server on port ' + (process.env.PORT || 3000));
});


// Auto-patched: Express starts immediately; DB connects in background
app.listen(process.env.PORT || 54251, () => console.log('[preview] Server on port ' + (process.env.PORT || 54251)));
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/preview')
  .then(() => console.log('[preview] MongoDB connected'))
  .catch(e => console.warn('[preview] MongoDB unavailable:', e.message));
