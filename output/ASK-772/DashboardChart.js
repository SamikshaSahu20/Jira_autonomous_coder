import React from 'react';
import { Chart } from 'react-chartjs-2';

const DashboardChart = ({ title, type, data }) => {
  const chartData = {
    labels: data.labels,
    datasets: data.datasets,
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: title,
      },
    },
  };

  return (
    <div>
      <h2>{title}</h2>
      <Chart type={type} data={chartData} options={options} />
    </div>
  );
};

export default DashboardChart;