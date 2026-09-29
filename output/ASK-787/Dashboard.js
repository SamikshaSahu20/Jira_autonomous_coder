import React, { useEffect, useState } from 'react';
import RegionChart from './RegionChart';
import { getWeatherData } from '../services/weatherApi';

const Dashboard = () => {
  const [weatherData, setWeatherData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const data = await getWeatherData();
      setWeatherData(data);
    };

    fetchData();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      {weatherData.map((region) => (
        <RegionChart key={region.region} region={region} />
      ))}
    </div>
  );
};

export default Dashboard;