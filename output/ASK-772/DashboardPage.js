import React, { useEffect, useState } from 'react';
import DashboardChart from './DashboardChart';
import { fetchAnalyticsData } from './api';

const DashboardPage = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchAnalyticsData();
        setAnalyticsData(data);
      } catch (err) {
        setError('Failed to load analytics data.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div>
      <h1>Dashboard</h1>
      {analyticsData && (
        <div>
          <DashboardChart
            title="Crop Yield Trends"
            type="line"
            data={analyticsData.cropYield}
          />
          <DashboardChart
            title="Weather Patterns"
            type="bar"
            data={analyticsData.weatherPatterns}
          />
          <DashboardChart
            title="Financial Metrics"
            type="pie"
            data={analyticsData.financialMetrics}
          />
        </div>
      )}
    </div>
  );
};

export default DashboardPage;