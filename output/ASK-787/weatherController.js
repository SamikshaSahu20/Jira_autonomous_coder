const { fetchWeatherData } = require('./weatherService');

const getWeatherData = (req, res) => {
  try {
    const data = fetchWeatherData();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
};

module.exports = { getWeatherData };