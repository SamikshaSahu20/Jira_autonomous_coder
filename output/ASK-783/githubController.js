const axios = require('axios');

const getGitHubMetrics = async (req, res) => {
  try {
    const { GITHUB_TOKEN } = process.env;
    if (!GITHUB_TOKEN) {
      return res.status(500).json({ error: 'GitHub token is not configured' });
    }
    const headers = { Authorization: `Bearer ${GITHUB_TOKEN}` };

    const [copilotUsage, ticketStatus, deadlines] = await Promise.all([
      axios.get('https://api.github.com/user/copilot', { headers }),
      axios.get('https://api.github.com/issues', { headers }),
      axios.get('https://api.github.com/repos/:owner/:repo/milestones', { headers }),
    ]);

    res.json({
      copilotUsage: copilotUsage.data,
      ticketStatus: ticketStatus.data,
      deadlines: deadlines.data,
    });
  } catch (error) {
    console.error('Error fetching GitHub metrics:', error.message);
    res.status(500).json({ error: 'Failed to fetch GitHub metrics' });
  }
};

module.exports = { getGitHubMetrics };