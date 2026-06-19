import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/clerk-react';
import Footer from './Footer';

export default function PublicLayout() {
  const { isSignedIn } = useAuth();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname, isSignedIn]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div className="public-layout">
      <header className="public-header">
        <div className="container public-header-content">
          <div className="public-header-bar">
            <button
              type="button"
              className="public-menu-toggle"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-expanded={isMenuOpen}
              aria-controls="public-main-nav"
              aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {isMenuOpen ? '✕' : '☰'}
            </button>

            <Link to="/" className="brand-link" aria-label="Whole Process Design home" onClick={closeMenu}>
              <img
                src="/images/wpd-logo-wordmark-lockup.png"
                alt="Whole Process Design"
                className="brand-wordmark"
              />
            </Link>
          </div>

          <nav
            id="public-main-nav"
            className={`public-nav ${isMenuOpen ? 'is-open' : ''}`}
            aria-label="Main"
          >
            <Link to="/what-is-wpd" onClick={closeMenu}>What is WPD?</Link>
            <Link to="/about" onClick={closeMenu}>About</Link>
            <Link to="/pricing" onClick={closeMenu}>Pricing</Link>
            {isSignedIn ? (
              <Link to="/dashboard" className="btn-primary" onClick={closeMenu}>Dashboard</Link>
            ) : (
              <>
                <SignInButton mode="modal">
                  <button className="btn-text" onClick={closeMenu}>Log in</button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="btn-primary" onClick={closeMenu}>Get Started</button>
                </SignUpButton>
              </>
            )}
          </nav>

          <div className="public-header-user">
            {isSignedIn ? (
              <UserButton afterSignOutUrl="/" />
            ) : (
              <span className="public-header-user-spacer" aria-hidden="true" />
            )}
          </div>
        </div>
      </header>

      <main className="public-main">
        <div className="container public-content-wrap">
          <Outlet />
        </div>
      </main>

      <Footer />
    </div>
  );
}
