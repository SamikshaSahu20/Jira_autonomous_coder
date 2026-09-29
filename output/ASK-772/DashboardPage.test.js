import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from './DashboardPage';
import { fetchAnalyticsData } from './api';

jest.mock('./api');

test('renders loading state initially', () => {
  fetchAnalyticsData.mockResolvedValueOnce({});
  render(<DashboardPage />);
  expect(screen.getByText(/Loading.../i)).toBeInTheDocument();
});

test('renders analytics data', async () => {
  fetchAnalyticsData.mockResolvedValueOnce({
    cropYield: { labels: ['Jan'], datasets: [{ label: 'Crop Yield', data: [10] }] },
    weatherPatterns: { labels: ['Sunny'], datasets: [{ label: 'Weather', data: [30] }] },
    financialMetrics: { labels: ['Revenue'], datasets: [{ label: 'Finance', data: [100000] }] },
  });

  render(<DashboardPage />);
  await waitFor(() => expect(screen.getByText(/Crop Yield Trends/i)).toBeInTheDocument());
  expect(screen.getByText(/Weather Patterns/i)).toBeInTheDocument();
  expect(screen.getByText(/Financial Metrics/i)).toBeInTheDocument();
});