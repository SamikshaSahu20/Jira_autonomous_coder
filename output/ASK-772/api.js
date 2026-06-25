export const fetchAnalyticsData = async () => {
  const response = await fetch('/analytics');
  if (!response.ok) {
    throw new Error('Failed to fetch analytics data');
  }
  return response.json();
};