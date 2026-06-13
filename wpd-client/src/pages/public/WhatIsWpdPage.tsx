import { Link } from 'react-router-dom';

export default function WhatIsWpdPage() {
  return (
    <div className="marketing-page">
      <section className="marketing-section">
        <h1>What is Whole Process Design?</h1>
        <p>
          Whole Process Design is a practical framework for diagnosing process weakness through four connected
          lenses: business, information, human, and organizational systems.
        </p>
        <p>
          The goal is not to overwhelm teams with theory. The goal is to create shared clarity, prioritize the
          right interventions, and improve execution with a durable structure.
        </p>
        <p>
          In this MVP, you can run a guided diagnostic and get a clear, useful snapshot of where your process is
          under tension.
        </p>
        <div className="hero-actions">
          <Link to="/register" className="btn-primary">Start free diagnostic</Link>
          <Link to="/lenses" className="btn-secondary">View the lenses</Link>
        </div>
      </section>
    </div>
  );
}
