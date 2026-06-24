const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const apiRoutes = require('./api');

const app = express();

app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files (e.g., index.html)

app.use('/api', apiRoutes);

app.listen(process.env.PORT || 3000, () => 
  console.log('Server running on port ' + (process.env.PORT || 3000))
);


// Auto-patched: Express starts immediately; DB connects in background
app.listen(process.env.PORT || 58084, () => console.log('[preview] Server on port ' + (process.env.PORT || 58084)));
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/preview')
  .then(() => console.log('[preview] MongoDB connected'))
  .catch(e => console.warn('[preview] MongoDB unavailable:', e.message));
