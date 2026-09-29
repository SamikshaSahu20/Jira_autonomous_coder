import React from 'react';

const Header = ({ toggleTheme, darkMode }) => {
  return (
    <header
      style={{
        backgroundColor: darkMode ? '#333' : '#4CAF50',
        color: darkMode ? '#fff' : 'white',
        padding: '1rem',
        textAlign: 'center',
      }}
    >
      <h1>Crop Weather Monitoring Dashboard</h1>
      <button
        onClick={toggleTheme}
        style={{
          marginTop: '10px',
          padding: '0.5rem 1rem',
          backgroundColor: darkMode ? '#555' : '#fff',
          color: darkMode ? '#fff' : '#4CAF50',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
        }}
      >
        Toggle {darkMode ? 'Light' : 'Dark'} Mode
      </button>
    </header>
  );
};

export default Header;