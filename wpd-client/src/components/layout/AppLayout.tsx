import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="container">
          <div className="header-content">
            <div>
              <h1 className="logo">WPD</h1>
              <p className="user-info">{user?.email}</p>
            </div>
            <button onClick={handleLogout} className="btn-text">
              Log Out
            </button>
          </div>
        </div>
      </header>
      <main className="app-main">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}