import { Link } from 'react-router-dom';
import { useAuth, SignUpButton } from '@clerk/clerk-react';

export default function WhatIsWpdPage() {
  const { isSignedIn } = useAuth();

  return (
    <div className="marketing-page">
      {/* Hero Section */}
      <section className="marketing-section">
        <h1>What is Whole Process Design?</h1>
        <p className="lead-paragraph">
          A practical method for fixing systems you don't fully control. For the middle managers carrying responsibility for outcomes, even when you don't control every system, budget, or policy around them.
        </p>
      </section>

      {/* The Problem */}
      <section className="marketing-section">
        <h2>You feel it every day</h2>
        <blockquote className="quote-callout">
          "You know the difference. You feel it—the friction, the rework, the missed handoffs, the inconsistent results. What you don't have—yet—is a consistent way to interpret those signals and decide what to do about it."
        </blockquote>
        <p>
          Most organizations are running on systems that are fragmented across functions, misaligned across disciplines, and often maintained by personalities instead of principles. The result: broken workflows that drain your team's energy, confusion about accountability, and performance that falls short of what's possible.
        </p>
      </section>

      {/* The Framework */}
      <section className="marketing-section">
        <h2>Four lenses, one diagnosis</h2>
        <p>
          Whole Process Design turns that uneasy feeling into precise diagnosis using four interconnected system lenses:
        </p>
        
        {/* Four-Quadrant Lens Layout */}
        <div className="four-lenses-quadrant">
          <div className="lens-quadrant lens-top-left">
            <img src="/images/lens-business.svg" alt="Business Systems" className="lens-quad-icon" />
            <h3>Business Systems</h3>
            <p>Rules, policies, and standards that define how work gets done</p>
          </div>
          
          <div className="lens-quadrant lens-top-right">
            <img src="/images/lens-people.svg" alt="People Systems" className="lens-quad-icon" />
            <h3>People Systems</h3>
            <p>Skills, behaviors, and culture that determine how individuals and teams actually perform</p>
          </div>
          
          <div className="lens-center-circle">
            <div className="wpd-center-content">
              <img src="/images/lens-wpd-center.svg" alt="Whole Process Design" className="wpd-center-image" />
            </div>
          </div>
          
          <div className="lens-quadrant lens-bottom-left">
            <img src="/images/lens-information.svg" alt="Information Systems" className="lens-quad-icon" />
            <h3>Information Systems</h3>
            <p>Technology and data flows that capture, move, and inform operational decisions</p>
          </div>
          
          <div className="lens-quadrant lens-bottom-right">
            <img src="/images/lens-organizational.svg" alt="Organizational Systems" className="lens-quad-icon" />
            <h3>Organizational Systems</h3>
            <p>Structure, governance, and roles that shape accountability and decision-making</p>
          </div>
        </div>

        <p style={{ marginTop: '2rem' }}>
          Most interventions fail because they address only one lens while the others stay misaligned. WPD forces you to think about all four—even when you can only change some of them.
        </p>
      </section>

      {/* How It Works */}
      <section className="marketing-section">
        <h2>How the method works</h2>
        <div className="method-steps">
          <div className="step">
            <h3>1. Diagnose</h3>
            <p>
              Answer guided questions across all four lenses. Identify where your system is under tension, what's causing the friction, and where the real problems hide beneath the surface.
            </p>
          </div>
          <div className="step">
            <h3>2. See the whole picture</h3>
            <p>
              Get a structured view of which systems are strong, which are weak, and how they interact. Understand why changing one thing creates problems elsewhere.
            </p>
          </div>
          <div className="step">
            <h3>3. Act with confidence</h3>
            <p>
              Make targeted interventions with awareness of the downstream effects. Improve at the margins where you can, and invest strategically in the systems that matter most.
            </p>
          </div>
        </div>
      </section>

      {/* Why It Matters */}
      <section className="marketing-section">
        <h2>The payoff</h2>
        <blockquote className="quote-callout">
          "You may not hold the keys (or the budget) to build the system of your dreams. It doesn't matter. Perfect doesn't exist. Waiting for someone else to fix it is how broken systems persist."
        </blockquote>
        <p>
          When your processes are aligned across all four lenses, something shifts. Work gets done on time. Reports are reliable. Quality stays high. Turnover drops. Costs go down. To the outsider, it looks like magic. But it's not—it's the difference between systems designed by one person and systems reinforced by alignment.
        </p>
      </section>

      {/* CTA */}
      <section className="marketing-section cta-section">
        <h2>Get started</h2>
        <div className="cta-content">
          <div className="cta-text">
            <p>
              Choose a process you want to improve—a workflow that's broken, a team that's struggling, a system that never quite works the way it should. 
              The WPD diagnostic will walk you through guided questions across all four lenses, understanding your context, constraints, and what success looks like.
            </p>
            <p>
              In minutes, you'll have a clear picture of where your system is under tension, which lenses are contributing to the problem, and what you can actually fix 
              with the resources and authority you have. No theory. No overwhelming frameworks. Just actionable insight you can use immediately.
            </p>
          </div>
          <div className="cta-action">
            {isSignedIn ? (
              <Link to="/dashboard" className="btn-primary btn-large">Run a diagnostic</Link>
            ) : (
              <SignUpButton mode="modal">
                <button className="btn-primary btn-large">Start free diagnostic</button>
              </SignUpButton>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
