import { Link } from 'react-router-dom';

const testimonials = [
  {
    name: '[Author name to come]',
    title: '[Author title to come]',
    quote: '[Praise quote placeholder]',
  },
  {
    name: '[Author name to come]',
    title: '[Author title to come]',
    quote: '[Praise quote placeholder]',
  },
  {
    name: '[Author name to come]',
    title: '[Author title to come]',
    quote: '[Praise quote placeholder]',
  },
];

export default function AboutPage() {
  return (
    <div className="marketing-page">
      {/* ── Book Hero Section ── */}
      <section className="about-hero">
        <div className="about-hero-content">
          <div className="about-book-container">
            <div className="about-book-cover">
              <div className="book-spine-accent"></div>
              <div className="book-cover-content">
                <div className="book-title">Whole Process Design</div>
                <div className="book-subtitle">A Practical Method for Fixing Systems You Don't Fully Control</div>
                <div className="book-author">Steve Krile, CPE</div>
              </div>
            </div>
            <div className="about-book-status">
              <p className="coming-soon-text">Coming Soon</p>
            </div>
          </div>
          <div className="about-description">
            <p className="about-intro">
              <strong>Whole Process Design</strong> is a practical method for diagnosing and fixing the systems you work in every day—even when you don't control them all.
            </p>
            <p>
              If you're a middle manager, project lead, or operations professional responsible for outcomes across departments and teams, this book gives you the tools and language to:
            </p>
            <ul className="about-benefits">
              <li>See the hidden systems causing your problems</li>
              <li>Name what's broken in ways your team understands</li>
              <li>Take action without waiting for permission</li>
              <li>Build credibility by delivering real results</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Platform Introduction ── */}
      <section className="about-platform-section">
        <h2>WholeProcessDesign.com</h2>
        <p className="platform-tagline">
          A workspace to explore the concepts of the book and apply them directly to your work.
        </p>
        <p className="platform-description">
          This platform brings the Four System Lenses to life through interactive diagnostic tools. Import your real processes, run a structured diagnostic across Business, Information, People, and Organizational systems, and surface the gaps you need to fix.
        </p>
        <p className="platform-note">
          Whether you read the book first or start with the application, you'll have a structured approach to solving the systems problems that have been holding you back.
        </p>
      </section>

      {/* ── Praise Section ── */}
      <section className="about-praise-section">
        <h2 className="praise-heading">Praise for Whole Process Design</h2>
        <div className="praise-grid">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="praise-card">
              <p className="praise-quote">"{testimonial.quote}"</p>
              <div className="praise-attribution">
                <p className="praise-name">{testimonial.name}</p>
                <p className="praise-title">{testimonial.title}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── About the Author ── */}
      <section className="about-author-section">
        <h2>About the Author</h2>
        <div className="author-content">
          <div className="author-info">
            <h3>Steve Krile, CPE</h3>
            <p>
              <strong>Certified Professional Ergonomist (CPE)</strong> with 30+ years of experience in operations, business process improvement, and organizational design across manufacturing, healthcare, technology, and professional services industries.
            </p>
            <p>
              Throughout his career, Steve has led teams responsible for outcomes they didn't fully control—balancing competing priorities, navigating organizational silos, and fixing broken systems from the inside. This real-world experience shaped the Whole Process Design method.
            </p>
            <p>
              When he's not thinking about systems, Steve enjoys woodworking, cycling, and exploring what makes good design work in both digital and physical spaces.
            </p>
            <div className="author-links">
              <a
                href="https://www.linkedin.com/in/skrile/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                LinkedIn Profile
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="about-cta-section">
        <div className="about-cta-card">
          <h2>Ready to fix your systems?</h2>
          <p>
            Start with WholeProcessDesign.com to apply these methods to your real processes right now.
          </p>
          <Link to="/what-is-wpd" className="btn-primary">
            Explore the Platform
          </Link>
        </div>
      </section>
    </div>
  );
}
