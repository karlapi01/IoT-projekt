import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const ROLE_LABEL = { admin: 'Admin', tenant: 'Tenant', customer: 'Student' };

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="nav">
      <h1>Redometar</h1>
      <div className="nav-right">
        <span>{user?.name}</span>
        <span className={`badge badge-${user?.role === 'admin' ? 'red' : user?.role === 'tenant' ? 'blue' : 'green'}`}>
          {ROLE_LABEL[user?.role]}
        </span>
        <button className="btn btn-secondary" onClick={handleLogout}>Odjava</button>
      </div>
    </nav>
  );
}
