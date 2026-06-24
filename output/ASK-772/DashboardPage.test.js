import { render, screen, waitFor } from '@testing-library/react';
import { AuthContext } from '../context/AuthContext';
import DashboardPage from '../pages/DashboardPage';
import { fetchAnalytics } from '../utils/api';

jest.mock('../utils/api');

describe('DashboardPage', () => {
    it('renders loading state initially', () => {
        render(
            <AuthContext.Provider value={{ isAuthenticated: true }}>
                <DashboardPage />
            </AuthContext.Provider>
        );
        expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('renders analytics data after fetching', async () => {
        fetchAnalytics.mockResolvedValue([
            { data: [{ label: 'Test', data: [1, 2, 3] }], labels: ['Jan', 'Feb', 'Mar'], options: { title: 'Test Chart' } },
        ]);

        render(
            <AuthContext.Provider value={{ isAuthenticated: true }}>
                <DashboardPage />
            </AuthContext.Provider>
        );

        await waitFor(() => expect(screen.getByText(/analytics dashboard/i)).toBeInTheDocument());
        expect(screen.getByText(/test chart/i)).toBeInTheDocument();
    });

    it('renders error message on fetch failure', async () => {
        fetchAnalytics.mockRejectedValue(new Error('Failed to fetch'));

        render(
            <AuthContext.Provider value={{ isAuthenticated: true }}>
                <DashboardPage />
            </AuthContext.Provider>
        );

        await waitFor(() => expect(screen.getByText(/failed to load analytics data/i)).toBeInTheDocument());
    });
});