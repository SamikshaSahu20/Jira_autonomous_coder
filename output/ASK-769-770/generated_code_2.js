import React from 'react';
import { ThemeProvider } from './ThemeContext';
import HomePage from './HomePage';

function App() {
  return (
    <ThemeProvider>
      <div>
        <HomePage />
      </div>
    </ThemeProvider>
  );
}

export default App;