const express = require('express');
const mongoose = require('mongoose');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();

app.use(express.json());
app.use('/api', analyticsRoutes);

const PORT = process.env.PORT || 5000;


// Auto-patched: Express starts immediately; DB connects in background
const _PREVIEW_PORT = process.env.PORT || 5000;
app.listen(_PREVIEW_PORT, () => console.log('[preview] Server on port ' + _PREVIEW_PORT));
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/preview')
  .then(() => console.log('[preview] MongoDB connected'))
  .catch(e => console.warn('[preview] MongoDB unavailable:', e.message));
