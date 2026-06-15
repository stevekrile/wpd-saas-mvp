import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { useWpdAuth } from '../../features/auth/AuthContext';
import Footer from './Footer';
import Breadcrumbs from './Breadcrumbs';

export default function AppLayout() {
  const { wpdUser } = useWpdAuth();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="container">
          <div className="app-header-bar">
            <button
              type="button"
              className="app-menu-toggle"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-expanded={isMenuOpen}
              aria-controls="app-main-nav"
              aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {isMenuOpen ? '✕' : '☰'}
            </button>

            <div className="app-brand">
              <Link to="/" className="brand-link" aria-label="Home" onClick={closeMenu}>
                <img
                  src="/images/wpd-logo-wordmark-lockup.png"
                  alt="Whole Process Design"
                  className="brand-wordmark"
                />
              </Link>
            </div>
            <div className="app-user-controls">
              <p className="user-info">{wpdUser?.email}</p>
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>

          <nav id="app-main-nav" className={`app-nav ${isMenuOpen ? 'is-open' : ''}`} aria-label="App">
            <Link to="/dashboard" onClick={closeMenu}>Dashboard</Link>
            <Link to="/" onClick={closeMenu}>Home</Link>
            <Link to="/what-is-wpd" onClick={closeMenu}>What is WPD?</Link>
            <Link to="/pricing" onClick={closeMenu}>Pricing</Link>
          </nav>
        </div>
      </header>
      <main className="app-main">
        <div className="container">
          <Breadcrumbs />
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
}
