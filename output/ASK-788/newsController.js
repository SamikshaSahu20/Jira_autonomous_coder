const newsService = require('./newsService');

exports.getAllNews = async (req, res) => {
  try {
    const news = await newsService.fetchAllNews();
    res.json(news);
  } catch (error) {
    console.error('Error fetching all news:', error.message);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
};

exports.getNewsByCategory = async (req, res) => {
  try {
    const category = req.params.category;
    const news = await newsService.fetchNewsByCategory(category);
    res.json(news);
  } catch (error) {
    console.error('Error fetching news by category:', error.message);
    res.status(500).json({ error: 'Failed to fetch news by category' });
  }
};

exports.searchNews = async (req, res) => {
  try {
    const query = req.params.query;
    const news = await newsService.searchNews(query);
    res.json(news);
  } catch (error) {
    console.error('Error searching news:', error.message);
    res.status(500).json({ error: 'Failed to search news' });
  }
};