const express = require('express');
const router = express.Router();

// Mock data for analytics
const analyticsData = {
  cropYield: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [
      {
        label: 'Crop Yield',
        data: [10, 20, 30, 40, 50],
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
    ],
  },
  weatherPatterns: {
    labels: ['Sunny', 'Rainy', 'Cloudy', 'Stormy'],
    datasets: [
      {
        label: 'Weather Patterns',
        data: [30, 20, 25, 25],
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'],
      },
    ],
  },
  financialMetrics: {
    labels: ['Revenue', 'Expenses', 'Profit'],
    datasets: [
      {
        label: 'Financial Metrics',
        data: [100000, 50000, 50000],
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'],
      },
    ],
  },
};

router.get('/analytics', (req, res) => {
  try {
    res.json(analyticsData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

module.exports = router;