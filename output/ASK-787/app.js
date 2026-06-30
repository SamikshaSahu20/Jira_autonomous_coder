import React, { useState } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';

const App = () => {
  const [darkMode, setDarkMode] = useState(false);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className={darkMode ? 'dark-mode' : 'light-mode'}>
      <Header toggleTheme={toggleTheme} darkMode={darkMode} />
      <Dashboard />
    </div>
  );
};

export default App;