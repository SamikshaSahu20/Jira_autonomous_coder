import React, { useContext, useEffect, useState } from 'react';
import AuthContext from '../context/AuthContext';
import { fetchAnalytics } from '../utils/api';
import DashboardChart from '../components/DashboardChart';

function DashboardPage() {
    const { isAuthenticated } = useContext(AuthContext);
    const [analyticsData, setAnalyticsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isAuthenticated) {
            fetchAnalytics()
                .then(data => {
                    setAnalyticsData(data);
                    setLoading(false);
                })
                .catch(err => {
                    setError('Failed to load analytics data');
                    setLoading(false);
                });
        }
    }, [isAuthenticated]);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>{error}</div>;

    return (
        <div>
            <h1>Analytics Dashboard</h1>
            {analyticsData && analyticsData.map((chartData, index) => (
                <DashboardChart
                    key={index}
                    data={chartData.data}
                    labels={chartData.labels}
                    options={chartData.options}
                />
            ))}
        </div>
    );
}

export default DashboardPage;