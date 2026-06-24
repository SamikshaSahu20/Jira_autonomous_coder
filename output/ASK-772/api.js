export const fetchAnalytics = async () => {
    try {
        const response = await fetch('/api/analytics');
        if (!response.ok) throw new Error('Failed to fetch analytics data');
        return await response.json();
    } catch (error) {
        console.error(error);
        throw error;
    }
};