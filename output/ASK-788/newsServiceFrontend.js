export const fetchNews = async () => {
  const response = await fetch('/api/news');
  if (!response.ok) throw new Error('Failed to fetch news');
  return response.json();
};

export const fetchNewsByCategory = async (category) => {
  const response = await fetch(`/api/news/${category}`);
  if (!response.ok) throw new Error('Failed to fetch news by category');
  return response.json();
};

export const searchNews = async (query) => {
  const response = await fetch(`/api/news/search/${query}`);
  if (!response.ok) throw new Error('Failed to search news');
  return response.json();
};