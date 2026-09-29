const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const calculatorRoutes = require('./calculatorRoutes');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve static files like index.html and styles.css

app.use('/api', calculatorRoutes);

app.listen(process.env.PORT || 3000, () => console.log('Server on port ' + (process.env.PORT || 3000)));