import { render, screen } from '@testing-library/react';
import DashboardChart from '../components/DashboardChart';

describe('DashboardChart', () => {
    it('renders chart with provided data', () => {
        const data = [{ label: 'Test', data: [1, 2, 3], backgroundColor: 'rgba(75,192,192,0.4)' }];
        const labels = ['Jan', 'Feb', 'Mar'];
        const options = { title: 'Test Chart' };

        render(<DashboardChart data={data} labels={labels} options={options} />);
        expect(screen.getByText(/test chart/i)).toBeInTheDocument();
    });
});