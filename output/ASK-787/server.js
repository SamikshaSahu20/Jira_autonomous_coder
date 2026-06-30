const express = require('express');
const path = require('path');
const weatherRoutes = require('./weatherRoutes');

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

app.use('/api/weather', weatherRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server on port ' + PORT));