import React, { useState, useEffect } from 'react';
import newsService from './newsService';
import NewsCard from './NewsCard';
import SearchBar from './SearchBar';
import CategoryFilter from './CategoryFilter';
import './NewsPage.module.css';

function NewsPage() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const data = await newsService.fetchAllNews();
      setNews(data);
    } catch (err) {
      setError('Failed to fetch news. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    try {
      setLoading(true);
      const data = await newsService.fetchNewsByQuery(query);
      setNews(data);
    } catch (err) {
      setError('Failed to fetch news. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryFilter = async (category) => {
    try {
      setLoading(true);
      const data = await newsService.fetchNewsByCategory(category);
      setNews(data);
    } catch (err) {
      setError('Failed to fetch news. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  if (loading) {
    return <div className="loader">Loading...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="newsPage">
      <SearchBar onSearch={handleSearch} />
      <CategoryFilter onFilter={handleCategoryFilter} />
      <div className="newsList">
        {news.map((article, index) => (
          <NewsCard key={index} article={article} />
        ))}
      </div>
    </div>
  );
}

export default NewsPage;