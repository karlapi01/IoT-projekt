import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import CustomerDashboard from './pages/CustomerDashboard';
import StudentView from './pages/StudentView';

function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'admin')    return <Navigate to="/admin" />;
  if (user.role === 'customer') return <Navigate to="/customer" />;
  if (user.role === 'student')  return <Navigate to="/student" />;
  return <Navigate to="/login" />;
}

function RequireAuth({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RoleRedirect />} />
          <Route path="/admin/*" element={
            <RequireAuth roles={['admin']}><AdminDashboard /></RequireAuth>
          } />
          <Route path="/customer/*" element={
            <RequireAuth roles={['customer']}><CustomerDashboard /></RequireAuth>
          } />
          <Route path="/student/*" element={
            <RequireAuth roles={['student']}><StudentView /></RequireAuth>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
