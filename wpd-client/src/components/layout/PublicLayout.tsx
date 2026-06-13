import { Outlet } from 'react-router-dom';

export default function PublicLayout() {
  return (
    <div className="public-layout">
      <header className="public-header">
        <div className="container">
          <h1 className="logo">WPD</h1>
          <p className="tagline">Whole Process Design</p>
        </div>
      </header>
      <main className="public-main">
        <Outlet />
      </main>
      <footer className="public-footer">
        <p>&copy; 2025 Whole Process Design. All rights reserved.</p>
      </footer>
    </div>
  );
}