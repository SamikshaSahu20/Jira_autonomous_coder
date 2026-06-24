import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function DashboardChart({ data, labels, options }) {
    const chartData = {
        labels: labels,
        datasets: data,
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: options.title || 'Chart',
            },
        },
        ...options,
    };

    return <Line data={chartData} options={chartOptions} />;
}

export default DashboardChart;