import React, { useContext } from 'react';
import { ThemeContext } from './ThemeContext';

const HomePage = () => {
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <div>
      <header>
        <button
          onClick={toggleTheme}
          aria-pressed={theme === 'dark'}
          className="theme-toggle-button"
        >
          {theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        </button>
      </header>
      <main>
        {/* Other components like ExpenseForm, ExpenseList, etc. */}
      </main>
    </div>
  );
};

export default HomePage;