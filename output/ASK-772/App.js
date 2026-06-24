import React, { useContext } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import AuthContext from './context/AuthContext';
import DashboardPage from './pages/DashboardPage';

function App() {
    const { isAuthenticated } = useContext(AuthContext);

    return (
        <Router>
            <Routes>
                <Route
                    path="/dashboard"
                    element={isAuthenticated ? <DashboardPage /> : <Navigate to="/login" />}
                />
                {/* Other routes */}
            </Routes>
        </Router>
    );
}

export default App;