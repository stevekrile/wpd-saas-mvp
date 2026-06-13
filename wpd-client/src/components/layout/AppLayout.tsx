import { Outlet, useNavigate, Link } from 'react-router-dom';
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
            <div className="app-brand">
              <Link to="/" className="brand-link" aria-label="Home">
                <img
                  src="/images/wpd-logo-wordmark-lockup.png"
                  alt="Whole Process Design"
                  className="brand-wordmark"
                />
              </Link>
            </div>
            <div className="app-user-controls">
              <p className="user-info">{user?.email}</p>
              <button onClick={handleLogout} className="btn-text">
                Log Out
              </button>
            </div>
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
