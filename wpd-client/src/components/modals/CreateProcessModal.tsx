import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { processApi } from '../../api/processApi';
import { PROCESS_CATEGORIES, type ProcessCategory } from './ProcessDiscoveryModal';
import '../styles/ProcessDiscoveryModal.css';

const CATEGORY_GUIDANCE: Record<string, {
  namePlaceholder: string;
  descriptionPlaceholder: string;
  problemPlaceholder: string;
  contextPlaceholder: string;
}> = {
  'customer-facing': {
    namePlaceholder: 'e.g., Customer Onboarding, Support Ticket Resolution',
    descriptionPlaceholder: 'Who interacts with this? What does successful completion look like?',
    problemPlaceholder: 'Where is the customer experience breaking down?',
    contextPlaceholder: 'Customer volume, SLAs, teams involved, tool stack, etc.',
  },
  'internal-ops': {
    namePlaceholder: 'e.g., Hiring Workflow, Expense Approval, Procurement',
    descriptionPlaceholder: 'Who starts it? Who completes it? What tools are used?',
    problemPlaceholder: 'Where do things get stuck or repeated?',
    contextPlaceholder: 'Team size, systems used, compliance requirements, etc.',
  },
  'team-workflow': {
    namePlaceholder: 'e.g., Sprint Planning, Code Review, Daily Standup',
    descriptionPlaceholder: 'How often? Who is involved? What is the expected output?',
    problemPlaceholder: 'Where does the team struggle — clarity, coordination, handoffs?',
    contextPlaceholder: 'Team size, time zones, tools, constraints, etc.',
  },
  'cross-functional': {
    namePlaceholder: 'e.g., Product Launch, Budget Planning, Incident Response',
    descriptionPlaceholder: 'Which teams are involved? What does success look like?',
    problemPlaceholder: 'Where do teams misalign or communication break down?',
    contextPlaceholder: 'Teams involved, decision-making structure, timeline constraints, etc.',
  },
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (processId: number) => void;
}

export default function CreateProcessModal({ isOpen, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<'category' | 'form'>('category');
  const [selectedCategory, setSelectedCategory] = useState<ProcessCategory | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [context, setContext] = useState('');
  const [formError, setFormError] = useState('');

  const guidance = selectedCategory
    ? CATEGORY_GUIDANCE[selectedCategory.id]
    : CATEGORY_GUIDANCE['customer-facing'];

  const createMutation = useMutation({
    mutationFn: processApi.createProcess,
    onSuccess: (process) => {
      onSuccess(process.id);
    },
    onError: (err: any) => {
      if (err.response?.status === 403) {
        setFormError(err.response.data.upgradePrompt || 'Process limit reached.');
      } else {
        setFormError('Failed to create process. Please try again.');
      }
    },
  });

  const handleClose = () => {
    setStep('category');
    setSelectedCategory(null);
    setName('');
    setDescription('');
    setProblemStatement('');
    setContext('');
    setFormError('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    createMutation.mutate({ name, description, problemStatement, context });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content create-process-modal" onClick={e => e.stopPropagation()}>

        {step === 'category' && (
          <>
            <div className="modal-header">
              <h2>Let's find a process to improve</h2>
              <p className="modal-subtitle">What type of process are you diagnosing?</p>
            </div>

            <div className="category-grid">
              {PROCESS_CATEGORIES.map((cat) => (
                <div
                  key={cat.id}
                  className={`category-card ${selectedCategory?.id === cat.id ? 'selected' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  <div className="category-header">
                    <div className="category-icon">{cat.icon}</div>
                    <h3>{cat.label}</h3>
                  </div>
                  <p className="category-description">{cat.description}</p>
                  <div className="category-details">
                    <div className="details-section">
                      <p className="section-label">Examples:</p>
                      <ul className="example-list">
                        {cat.examples.map(ex => <li key={ex}>{ex}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <button onClick={handleClose} className="btn-secondary">Cancel</button>
              <button
                disabled={!selectedCategory}
                className="btn-primary"
                onClick={() => setStep('form')}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === 'form' && selectedCategory && (
          <>
            <div className="modal-header">
              <div className="modal-header-row">
                <button className="btn-text modal-back" onClick={() => setStep('category')}>← Back</button>
                <span className="modal-category-badge">{selectedCategory.icon} {selectedCategory.label}</span>
              </div>
              <h2>Describe your process</h2>
              <p className="modal-subtitle">{selectedCategory.contextHint}</p>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="cp-name">Process Name *</label>
                <input
                  id="cp-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder={guidance.namePlaceholder}
                />
              </div>
              <div className="form-group">
                <label htmlFor="cp-desc">Description *</label>
                <textarea
                  id="cp-desc"
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                  placeholder={guidance.descriptionPlaceholder}
                />
              </div>
              <div className="form-group">
                <label htmlFor="cp-problem">What's not working? *</label>
                <textarea
                  id="cp-problem"
                  rows={3}
                  value={problemStatement}
                  onChange={e => setProblemStatement(e.target.value)}
                  required
                  placeholder={guidance.problemPlaceholder}
                />
              </div>
              <div className="form-group">
                <label htmlFor="cp-context">Context <span className="optional">(optional)</span></label>
                <textarea
                  id="cp-context"
                  rows={2}
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  placeholder={guidance.contextPlaceholder}
                />
              </div>

              {formError && <div className="error-message">{formError}</div>}

              <div className="modal-footer">
                <button type="button" onClick={handleClose} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="btn-primary">
                  {createMutation.isPending ? 'Creating…' : 'Create & Start Diagnostic'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
