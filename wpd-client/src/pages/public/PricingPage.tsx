import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';

const features = [
  { label: 'Processes', key: 'processes' },
  { label: 'WPD Lens Diagnostic', key: 'diagnostic' },
  { label: 'Implementation Planner', key: 'planner' },
  { label: 'OpEx Map', key: 'opex' },
  { label: 'Cost Justification', key: 'cost' },
  { label: 'Executive Summary', key: 'summary' },
  { label: 'Generative Change Management Tools', key: 'changeTools' },
];

const tiers = [
  {
    name: 'Starter',
    price: '$0',
    status: '',
    statusVariant: '',
    features: {
      processes: 'Three',
      diagnostic: 'Guided',
      planner: true,
      opex: true,
      cost: false,
      summary: false,
      changeTools: false,
    },
  },
  {
    name: 'Pro',
    price: '$10/mo',
    status: 'Coming soon',
    statusVariant: 'coming-soon',
    features: {
      processes: 'Unlimited',
      diagnostic: 'Agentic',
      planner: true,
      opex: true,
      cost: true,
      summary: true,
      changeTools: true,
    },
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    status: 'Planned',
    statusVariant: 'planned',
    features: {
      processes: 'Unlimited',
      diagnostic: 'Agentic',
      planner: true,
      opex: true,
      cost: true,
      summary: true,
      changeTools: true,
    },
  },
];

export default function PricingPage() {
  const { isSignedIn } = useAuth();

  return (
    <div className="marketing-page">
      <section className="marketing-section">
        <h1>Pricing and Access Tiers</h1>
        <p>Start with a useful free diagnostic workflow, then upgrade as your needs expand.</p>
      </section>

      <section className="pricing-comparison">
        <div className="pricing-table-wrapper">
          <table className="pricing-table">
            <thead>
              <tr>
                <th className="feature-column">Feature</th>
                {tiers.map((tier) => (
                  <th key={tier.name} className="tier-column">
                    <div className="tier-header">
                      <h2>{tier.name} Tier</h2>
                      {tier.status ? (
                        <span className={`tier-status-badge tier-status-${tier.statusVariant}`}>
                          {tier.status}
                        </span>
                      ) : (
                        <span className="tier-status-placeholder" />
                      )}
                      <p className="tier-price">{tier.price}</p>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((feature) => (
                <tr key={feature.key}>
                  <td className="feature-name">{feature.label}</td>
                  {tiers.map((tier) => {
                    const value = tier.features[feature.key as keyof typeof tier.features];
                    return (
                      <td key={`${tier.name}-${feature.key}`} className="feature-cell">
                        {typeof value === 'string' ? (
                          <span className="feature-value">
                            {value === 'Agentic' ? <>Agentic<sup>*</sup></> : value}
                          </span>
                        ) : value ? (
                          <span className="checkmark">✓</span>
                        ) : (
                          <span className="no-feature">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pricing-footnote"><sup>*</sup> Agentic diagnostic features are subject to use limitations.</p>
        </div>

        <div className="pricing-cta">
          {isSignedIn ? (
            <div className="pricing-logged-in">
              <p>You're currently on the Starter Tier. Pro and Enterprise tiers coming soon!</p>
              <Link to="/dashboard" className="btn-primary">Go to Dashboard</Link>
            </div>
          ) : (
            <div className="pricing-logged-out">
              <p>Ready to get started?</p>
              <Link to="/register" className="btn-primary">Create free account</Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
