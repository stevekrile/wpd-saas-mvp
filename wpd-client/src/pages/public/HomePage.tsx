import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { publicApi } from '../../api/publicApi';

export default function HomePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public', 'landing-content'],
    queryFn: publicApi.getLandingContent,
  });

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (isError || !data) {
    return (
      <div className="marketing-page">
        <section className="marketing-section">
          <h1>Whole Process Design</h1>
          <p>We couldn't load public content right now. Please refresh and try again.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="marketing-page">
      <section className="hero-section branded-hero">
        <div className="hero-grid">
          <div>
            <h1>{data.title}</h1>
            <blockquote className="hero-quote">
              Before WPD: meetings, rework, and blame. After WPD: shared language, clear ownership, and practical next steps your team can execute with confidence.
            </blockquote>
            <p className="middle-manager-subline">
              Built for middle managers who are responsible for outcomes, even when they do not control every system, budget, or policy around them.
            </p>
            <p className="hero-subtitle">{data.subtitle}</p>
            <div className="hero-actions">
              <Link to={data.callToActionRoute} className="btn-primary">{data.callToActionText}</Link>
              <Link to="/lenses" className="btn-secondary">Explore the four lenses</Link>
            </div>
          </div>
          <img
            src="/images/wpd-concept-options-board-4x3.png"
            alt="Whole Process Design conceptual board"
            className="hero-image"
          />
        </div>
      </section>

      <section className="marketing-section middle-manager-section">
        <h2>For the people in the middle</h2>
        <p>
          You are expected to deliver quality, pace, and results while navigating imperfect tools, inherited rules, and competing priorities.
          WPD gives you a practical way to diagnose what is actually failing and move your team forward without waiting for a top-down rescue.
        </p>
      </section>

      <section className="marketing-section">
        <h2>What this gives you</h2>
        <ul className="marketing-list">
          {data.highlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="marketing-section">
        <h2>Common distress signals</h2>
        <ul className="marketing-list">
          {data.distressSignals.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
