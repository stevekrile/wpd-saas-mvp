import { Link, Outlet } from 'react-router-dom';
import { SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/clerk-react';

export default function PublicLayout() {
  const { isSignedIn } = useAuth();

  return (
    <div className="public-layout">
      <header className="public-header">
        <div className="container public-header-content">
          <Link to="/" className="brand-link" aria-label="Whole Process Design home">
            <img
              src="/images/wpd-logo-wordmark-lockup.png"
              alt="Whole Process Design"
              className="brand-wordmark"
            />
          </Link>

          <nav className="public-nav" aria-label="Main">
            <Link to="/what-is-wpd">What is WPD?</Link>
            <Link to="/lenses">Four Lenses</Link>
            <Link to="/pricing">Pricing</Link>
            {isSignedIn ? (
              <>
                <Link to="/dashboard" className="btn-primary">Dashboard</Link>
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <>
                <SignInButton mode="modal">
                  <button className="btn-text">Log in</button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="btn-primary">Get Started</button>
                </SignUpButton>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="public-main">
        <div className="container public-content-wrap">
          <Outlet />
        </div>
      </main>

      <footer className="public-footer">
        <div className="container footer-content">
          <div className="footer-brand">
            <img
              src="/images/wpd-logo-primary-color.png"
              alt="WPD"
              className="footer-mark"
            />
            <p>Whole Process Design</p>
          </div>
          <p className="footer-copy">Structured diagnosis and practical system improvement.</p>
        </div>
      </footer>
    </div>
  );
}
