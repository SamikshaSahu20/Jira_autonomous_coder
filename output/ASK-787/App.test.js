import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders header and dashboard', () => {
  render(<App />);
  expect(screen.getByText(/Crop Weather Monitoring Dashboard/i)).toBeInTheDocument();
});