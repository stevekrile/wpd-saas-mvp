import { Link } from 'react-router-dom';

export default function PricingPage() {
  return (
    <div className="marketing-page">
      <section className="marketing-section">
        <h1>Pricing and Access Tiers</h1>
        <p>Start with a useful free diagnostic workflow, then upgrade as your needs expand.</p>
      </section>

      <section className="pricing-grid">
        <article className="pricing-card">
          <h2>Public</h2>
          <p className="price"></p>
          <ul className="marketing-list">
            <li>Method overview</li>
            <li>Four lens descriptions</li>
            <li>No diagnostic workspace</li>
          </ul>
        </article>

        <article className="pricing-card featured">
          <h2>Free Member</h2>
          <p className="price"></p>
          <ul className="marketing-list">
            <li>One active process</li>
            <li>Guided four-lens diagnostic</li>
            <li>Basic tension summary</li>
          </ul>
          <Link to="/register" className="btn-primary">Create free account</Link>
        </article>

        <article className="pricing-card">
          <h2>Pro (Later)</h2>
          <p className="price">Planned</p>
          <ul className="marketing-list">
            <li>Multiple active processes</li>
            <li>Artifact support</li>
            <li>Export capabilities</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
