import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '20px', fontFamily: 'monospace' }}>Loading session...</div>;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export const AdminRoute = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '20px', fontFamily: 'monospace' }}>Loading session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return user && user.role === 'admin' ? (
    <Outlet />
  ) : (
    <div style={{ padding: '40px', fontFamily: 'monospace', textAlign: 'center' }}>
      <h1>403 - Forbidden</h1>
      <p>Only platform administrators are authorized to access this dashboard.</p>
      <a href="/home" style={{ color: '#000', textDecoration: 'underline' }}>Back to Home Feed</a>
    </div>
  );
};
