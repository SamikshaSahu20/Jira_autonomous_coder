const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const authController = require('./authController');

const app = express();

// Middleware
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(bodyParser.json());

// Routes
app.post('/api/login', authController.login);

// Serve static files
app.use(express.static('public'));

// Fallback to serve index.html
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Start server and connect to DB
app.listen(process.env.PORT || 3000, () => console.log('Server on port ' + (process.env.PORT || 3000)));
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cropwise-grower-metrics')
  .catch(e => console.error('DB connection error:', e.message));