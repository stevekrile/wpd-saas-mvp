import { Outlet, Link } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { useWpdAuth } from '../../features/auth/AuthContext';
import Footer from './Footer';
import Breadcrumbs from './Breadcrumbs';

export default function AppLayout() {
  const { wpdUser } = useWpdAuth();

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
              <p className="user-info">{wpdUser?.email}</p>
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
