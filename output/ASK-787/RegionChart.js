import React from 'react';
import { Line, Bar } from 'react-chartjs-2';

const RegionChart = ({ region }) => {
  const { region: regionName, temperature, humidity, rainfall } = region;

  const temperatureData = {
    labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4'],
    datasets: [
      {
        label: 'Temperature (°C)',
        data: temperature,
        borderColor: 'rgba(255, 99, 132, 1)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        fill: true,
      },
    ],
  };

  const humidityData = {
    labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4'],
    datasets: [
      {
        label: 'Humidity (%)',
        data: humidity,
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
      },
    ],
  };

  const rainfallData = {
    labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4'],
    datasets: [
      {
        label: 'Rainfall (mm)',
        data: rainfall,
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      },
    ],
  };

  return (
    <div style={{ marginBottom: '40px' }}>
      <h2>{regionName}</h2>
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        <div style={{ width: '30%' }}>
          <Line data={temperatureData} />
        </div>
        <div style={{ width: '30%' }}>
          <Bar data={humidityData} />
        </div>
        <div style={{ width: '30%' }}>
          <Bar data={rainfallData} />
        </div>
      </div>
    </div>
  );
};

export default RegionChart;