const mongoose = require('mongoose');

const AnalyticsSchema = new mongoose.Schema({
    metricName: { type: String, required: true },
    value: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Analytics', AnalyticsSchema);