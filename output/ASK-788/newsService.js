const axios = require('axios');

const API_URL = 'https://newsapi.org/v2';
const API_KEY = process.env.NEWS_API_KEY || 'your-api-key-here';

exports.fetchAllNews = async () => {
  const response = await axios.get(`${API_URL}/top-headlines?country=us&apiKey=${API_KEY}`);
  return response.data.articles;
};

exports.fetchNewsByCategory = async (category) => {
  const response = await axios.get(`${API_URL}/top-headlines?country=us&category=${category}&apiKey=${API_KEY}`);
  return response.data.articles;
};

exports.searchNews = async (query) => {
  const response = await axios.get(`${API_URL}/everything?q=${query}&apiKey=${API_KEY}`);
  return response.data.articles;
};