import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getSession, roleHome } from './utils/session';
import Login                  from './pages/Login';
import AdminDashboard         from './pages/AdminDashboard';
import StoreManagerDashboard  from './pages/StoreManagerDashboard';
import VishnuDashboard        from './pages/VishnuDashboard';
import DevtaDashboard         from './pages/DevtaDashboard';

function ProtectedRoute({ children, requiredRole }) {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  if (requiredRole && session.role !== requiredRole) {
    return <Navigate to={roleHome(session.role)} replace />;
  }
  return children;
}

function RootRedirect() {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={roleHome(session.role)} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"      element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />

        <Route path="/vishnu" element={
          <ProtectedRoute requiredRole="vishnu"><VishnuDashboard /></ProtectedRoute>
        } />
        <Route path="/admin/dashboard" element={
          <ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/store/dashboard" element={
          <ProtectedRoute requiredRole="store_manager"><StoreManagerDashboard /></ProtectedRoute>
        } />
        <Route path="/devta" element={
          <ProtectedRoute requiredRole="devta"><DevtaDashboard /></ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
