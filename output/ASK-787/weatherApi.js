export const getWeatherData = async () => {
  try {
    const response = await fetch('/api/weather');
    if (!response.ok) {
      throw new Error('Failed to fetch weather data');
    }
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
};