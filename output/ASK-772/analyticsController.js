const Analytics = require('../models/Analytics');

const getAnalytics = async (req, res) => {
    try {
        const analyticsData = await Analytics.find({});
        res.status(200).json(analyticsData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch analytics data' });
    }
};

module.exports = { getAnalytics };