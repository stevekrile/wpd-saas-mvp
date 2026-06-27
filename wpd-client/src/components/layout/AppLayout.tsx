import { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import Footer from './Footer';
import Breadcrumbs from './Breadcrumbs';
import ThemeMenu from './ThemeMenu';
import { useWpdAuth } from '../../features/auth/AuthContext';

export default function AppLayout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { wpdUser } = useWpdAuth();
  const isAdmin = wpdUser?.role === 'Admin' || wpdUser?.role === 'SystemAdmin';

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="container">
          <div className="app-header-content">
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
            </div>

            <nav id="app-main-nav" className={`app-nav ${isMenuOpen ? 'is-open' : ''}`} aria-label="App">
              <Link to="/what-is-wpd" onClick={closeMenu}>What is WPD?</Link>
              <Link to="/about" onClick={closeMenu}>About</Link>
              <Link to="/pricing" onClick={closeMenu}>Pricing</Link>
              {isAdmin && <Link to="/admin" onClick={closeMenu}>Admin</Link>}
              <Link to="/dashboard" className="btn-primary" onClick={closeMenu}>Dashboard</Link>
            </nav>

            <div className="app-user-controls">
              <ThemeMenu />
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
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
