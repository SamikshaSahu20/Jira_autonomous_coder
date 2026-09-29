const express = require('express');
const analyticsController = require('./analyticsController');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.static('public'));

app.use('/analytics', analyticsController);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(process.env.PORT || 3000, () =>
  console.log('Server on port ' + (process.env.PORT || 3000))
);