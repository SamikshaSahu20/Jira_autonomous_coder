import React, { createContext, useState } from 'react';
import { login as loginAPI } from '../utils/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'));

  const login = async (credentials) => {
    const response = await loginAPI(credentials);
    localStorage.setItem('authToken', response.token);
    setAuthToken(response.token);
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setAuthToken(null);
  };

  const isAuthenticated = () => !!authToken;

  return (
    <AuthContext.Provider value={{ authToken, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};