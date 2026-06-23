import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [email, setEmail] = useState(localStorage.getItem('email'));

  useEffect(() => {
    const handleStorageChange = () => {
      setToken(localStorage.getItem('token'));
      setEmail(localStorage.getItem('email'));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleLogin = (data) => {
    setToken(data.access_token);
    setEmail(data.email);
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('email', data.email);
  };

  const handleLogout = () => {
    setToken(null);
    setEmail(null);
    localStorage.removeItem('token');
    localStorage.removeItem('email');
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return <Dashboard email={email} onLogout={handleLogout} />;
}
