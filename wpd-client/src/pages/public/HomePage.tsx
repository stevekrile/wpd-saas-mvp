import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth, SignUpButton } from '@clerk/clerk-react';
import { publicApi } from '../../api/publicApi';

const lenses = [
  {
    img: '/images/lens-business.svg',
    alt: 'Business Systems',
    title: 'Business Systems',
    color: '#4fc3f7',
    body: 'The rules, policies, and standards that define how work gets done. From informal personality-driven habits to sophisticated operating systems—these are the structures your team navigates every day.',
  },
  {
    img: '/images/lens-information.svg',
    alt: 'Information Systems',
    title: 'Information Systems',
    color: '#81c784',
    body: 'The technology and data flows that capture, move, and make sense of operational information. Poor information systems create rework, mistrust, and decisions made in the dark.',
  },
  {
    img: '/images/lens-people.svg',
    alt: 'People Systems',
    title: 'People Systems',
    color: '#ffb74d',
    body: 'The skills, behaviors, and culture that determine how individuals and teams actually perform. Even the best processes fail when people systems are misaligned.',
  },
  {
    img: '/images/lens-organizational.svg',
    alt: 'Organizational Systems',
    title: 'Organizational Systems',
    color: '#ce93d8',
    body: 'The structure, governance, and roles that shape accountability and decision-making. Org systems determine who owns what—and whether that ownership is clear.',
  },
];

export default function HomePage() {
  const { isSignedIn } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public', 'landing-content'],
    queryFn: publicApi.getLandingContent,
  });

  if (isLoading) return <div className="loading">Loading...</div>;

  if (isError || !data) {
    return (
      <div className="marketing-page home-page">
        <section className="marketing-section">
          <h1>Whole Process Design</h1>
          <p>We couldn't load public content right now. Please refresh and try again.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="marketing-page">

      {/* ── Hero: full-width announcement ── */}
      <section className="home-hero-announce">
        <div className="home-hero-announce-text">
          <h1>{data.title}</h1>
          <p className="hero-subtitle">{data.subtitle}</p>
          {!isSignedIn && (
            <div className="hero-actions">
              <SignUpButton mode="modal">
                <button className="btn-primary">{data.callToActionText}</button>
              </SignUpButton>
            </div>
          )}
        </div>
        <div className="home-hero-announce-image">
          <img
            src="/images/wpd-hero-four-lenses.svg"
            alt="Whole Process Design — four interconnected system lenses"
          />
        </div>
      </section>

      {/* ── Before / After ── */}
      <section className="home-before-after-section">
        <h2 className="before-after-heading">The real cost of misaligned systems</h2>
        <div className="hero-before-after">
          <div className="hero-before-col">
            <p className="before-after-label risk-label">Risk</p>
            <ul className="before-list">
              <li><span className="icon-x">✗</span> Endless meetings, no resolution</li>
              <li><span className="icon-x">✗</span> Rework that drains the team</li>
              <li><span className="icon-x">✗</span> Blame without accountability</li>
              <li><span className="icon-x">✗</span> Problems you can feel but can't name</li>
            </ul>
          </div>
          <div className="before-after-arrow">→</div>
          <div className="hero-after-col">
            <p className="before-after-label opportunity-label">Opportunity</p>
            <ul className="after-list">
              <li><span className="icon-check">✓</span> Shared language across the team</li>
              <li><span className="icon-check">✓</span> Clear ownership of every gap</li>
              <li><span className="icon-check">✓</span> Practical next steps you can execute</li>
              <li><span className="icon-check">✓</span> Confidence to lead without waiting</li>
            </ul>
          </div>
        </div>
        <p className="middle-manager-subline">
          Built for middle managers who are responsible for outcomes, even when they do not control every system, budget, or policy around them.
        </p>
      </section>

      {/* ── Four lenses ── */}
      <section className="home-lenses-section">
        <h2 className="home-lenses-title">Diagnose through four lenses</h2>
        <p className="home-lenses-subtitle">Every process failure lives in one — or more — of these systems.</p>
        <div className="home-lenses-grid">
          {lenses.map((lens) => (
            <div key={lens.title} className="home-lens-card">
              <img src={lens.img} alt={lens.alt} className="home-lens-icon" />
              <h3 style={{ color: lens.color }}>{lens.title}</h3>
              <p>{lens.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA pair ── */}
      <div className="home-cta-pair">
        <div className="home-cta-card home-cta-process">
          <h2>Define your process</h2>
          <p>
            Start by naming what you're working on. Give it a context, a problem statement, and a clear description.
            WPD structures your thinking before the diagnosis begins.
          </p>
          <ul className="home-cta-list">
            {data.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {isSignedIn ? (
            <Link to="/dashboard" className="btn-primary">Create Process</Link>
          ) : (
            <SignUpButton mode="modal">
              <button className="btn-primary">Create Process</button>
            </SignUpButton>
          )}
        </div>

        <div className="home-cta-card home-cta-diagnostic">
          <h2>Run a diagnostic</h2>
          <p>
            Something feels off but you can't put your finger on it. These are the signals WPD is built to surface.
            Answer guided questions across all four lenses and get a structured picture of where your system is weak.
          </p>
          <ul className="home-cta-list">
            {data.distressSignals.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {isSignedIn ? (
            <Link to="/dashboard" className="btn-secondary">Start a diagnostic</Link>
          ) : (
            <SignUpButton mode="modal">
              <button className="btn-secondary">Start a diagnostic</button>
            </SignUpButton>
          )}
        </div>
      </div>

    </div>
  );
}
