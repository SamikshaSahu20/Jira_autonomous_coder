import { render } from '@testing-library/react';
import DashboardChart from './DashboardChart';

test('renders chart with correct title', () => {
  const data = {
    labels: ['Jan', 'Feb'],
    datasets: [{ label: 'Test Data', data: [10, 20] }],
  };

  const { getByText } = render(<DashboardChart title="Test Chart" type="line" data={data} />);
  expect(getByText(/Test Chart/i)).toBeInTheDocument();
});