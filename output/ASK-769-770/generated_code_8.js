import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { ThemeProvider } from './ThemeContext';
import HomePage from './HomePage';

describe('ThemeToggle', () => {
  it('toggles between light and dark modes', () => {
    const { getByText } = render(
      <ThemeProvider>
        <HomePage />
      </ThemeProvider>
    );

    const button = getByText('Switch to Dark Mode');
    fireEvent.click(button);
    expect(button).toHaveTextContent('Switch to Light Mode');
    expect(document.body.classList.contains('dark-mode')).toBe(true);

    fireEvent.click(button);
    expect(button).toHaveTextContent('Switch to Dark Mode');
    expect(document.body.classList.contains('light-mode')).toBe(true);
  });

  it('persists theme in localStorage', () => {
    localStorage.clear();
    const { getByText } = render(
      <ThemeProvider>
        <HomePage />
      </ThemeProvider>
    );

    const button = getByText('Switch to Dark Mode');
    fireEvent.click(button);
    expect(localStorage.getItem('theme')).toBe('dark');

    fireEvent.click(button);
    expect(localStorage.getItem('theme')).toBe('light');
  });
});