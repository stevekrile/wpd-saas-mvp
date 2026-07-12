/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import '../styles/ProcessDiscoveryModal.css';

export interface ProcessCategory {
  id: string;
  label: string;
  icon: string;
  description: string;
  examples: string[];
  painPoints: string[];
  contextHint: string;
}

export const PROCESS_CATEGORIES: ProcessCategory[] = [
  {
    id: 'customer-facing',
    label: 'Customer-Facing Process',
    icon: '👥',
    description: 'Workflows that directly impact customer experience',
    examples: ['Onboarding', 'Order fulfillment', 'Support resolution', 'Account setup'],
    painPoints: ['Slow handoffs', 'Inconsistent experience', 'Churn', 'Complaints'],
    contextHint: 'Think about a process where your customer feels the gaps'
  },
  {
    id: 'internal-ops',
    label: 'Internal Operations',
    icon: '⚙️',
    description: 'Back-office and operational workflows',
    examples: ['Hiring workflow', 'Procurement', 'Expense approval', 'IT onboarding'],
    painPoints: ['Bottlenecks', 'Approvals that never come', 'Lost information', 'Rework'],
    contextHint: 'Think about a process where work gets stuck or repeated'
  },
  {
    id: 'team-workflow',
    label: 'Team Workflow',
    icon: '👫',
    description: 'Daily collaboration and execution within a team',
    examples: ['Sprint planning', 'Code review', 'Meeting cadence', 'Knowledge sharing'],
    painPoints: ['Miscommunication', 'Unclear priorities', 'Context switching', 'Bottlenecks'],
    contextHint: 'Think about a process where your team struggles with clarity or coordination'
  },
  {
    id: 'cross-functional',
    label: 'Cross-Functional Process',
    icon: '🔗',
    description: 'Coordination between departments or teams',
    examples: ['Product launch', 'Budget planning', 'Strategic planning', 'Crisis response'],
    painPoints: ['Silos', 'Conflicting goals', 'Unclear ownership', 'Finger-pointing'],
    contextHint: 'Think about a process where teams struggle to work together'
  },
];

interface Props {
  onSelect: (category: ProcessCategory) => void;
  onClose: () => void;
  isOpen: boolean;
}

export default function ProcessDiscoveryModal({ onSelect, onClose, isOpen }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Let's find a process to improve</h2>
          <p className="modal-subtitle">
            What type of process are you diagnosing? We'll help you structure your thinking.
          </p>
        </div>

        <div className="category-grid">
          {PROCESS_CATEGORIES.map((category) => (
            <div
              key={category.id}
              className={`category-card ${selectedCategory === category.id ? 'selected' : ''}`}
              onClick={() => setSelectedCategory(category.id)}
            >
              <div className="category-header">
                <div className="category-icon">{category.icon}</div>
                <h3>{category.label}</h3>
              </div>
              <p className="category-description">{category.description}</p>
              
              <div className="category-details">
                <div className="details-section">
                  <p className="section-label">Examples:</p>
                  <ul className="example-list">
                    {category.examples.map((ex) => (
                      <li key={ex}>{ex}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="details-section">
                  <p className="section-label">Common pain points:</p>
                  <ul className="pain-point-list">
                    {category.painPoints.map((pp) => (
                      <li key={pp}>{pp}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {selectedCategory && (
          <div className="selected-hint">
            <p className="hint-icon">💡</p>
            <p className="hint-text">
              {PROCESS_CATEGORIES.find((c) => c.id === selectedCategory)?.contextHint}
            </p>
          </div>
        )}

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={() => {
              const selected = PROCESS_CATEGORIES.find((c) => c.id === selectedCategory);
              if (selected) {
                onSelect(selected);
              }
            }}
            disabled={!selectedCategory}
            className="btn-primary"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
