const express = require('express');
const { getGitHubMetrics } = require('./githubController');

const router = express.Router();

router.get('/metrics', getGitHubMetrics);

module.exports = router;