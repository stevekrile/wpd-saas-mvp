import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { processApi } from '../../api/processApi';
import ProcessDiscoveryModal, { type ProcessCategory } from '../../components/modals/ProcessDiscoveryModal';

const CATEGORY_CONTEXT: Record<string, { placeholder: string; label: string }> = {
  'customer-facing': {
    label: 'Customer-Facing Process',
    placeholder: 'e.g., Onboarding, Support resolution, Account setup',
  },
  'internal-ops': {
    label: 'Internal Operations',
    placeholder: 'e.g., Hiring workflow, Procurement, Expense approval',
  },
  'team-workflow': {
    label: 'Team Workflow',
    placeholder: 'e.g., Sprint planning, Code review, Knowledge sharing',
  },
  'cross-functional': {
    label: 'Cross-Functional Process',
    placeholder: 'e.g., Product launch, Budget planning, Strategic planning',
  },
};

export default function CreateProcessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [context, setContext] = useState('');
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProcessCategory | null>(null);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);

  // If no category passed via query param, show discovery modal
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (!categoryParam) {
      setShowDiscoveryModal(true);
    }
  }, [searchParams]);

  const handleSelectCategory = (category: ProcessCategory) => {
    setSelectedCategory(category);
    setShowDiscoveryModal(false);
    navigate(`/processes/create?category=${category.id}`);
  };

  const getCategoryContext = () => {
    if (selectedCategory) {
      return CATEGORY_CONTEXT[selectedCategory.id] || CATEGORY_CONTEXT['customer-facing'];
    }
    return CATEGORY_CONTEXT['customer-facing'];
  };

  const categoryContext = getCategoryContext();

  const createMutation = useMutation({
    mutationFn: processApi.createProcess,
    onSuccess: () => {
      navigate('/dashboard');
    },
    onError: (err: any) => {
      if (err.response?.status === 403) {
        setError(err.response.data.upgradePrompt || 'Process limit reached.');
      } else {
        setError('Failed to create process. Please try again.');
      }
    },
  });

  const handleSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');
    createMutation.mutate({
      name,
      description,
      problemStatement,
      context,
    });
  };

  return (
    <>
      <ProcessDiscoveryModal
        isOpen={showDiscoveryModal}
        onSelect={handleSelectCategory}
        onClose={() => navigate('/dashboard')}
      />

      <div className="create-process">
        <div className="page-header">
          <h1>Create New Process</h1>
          <button onClick={() => navigate('/dashboard')} className="btn-text">
            Cancel
          </button>
        </div>

        {selectedCategory && (
          <div className="category-banner">
            <p className="category-type">
              <span className="category-emoji">{selectedCategory.icon}</span>
              {selectedCategory.label}
            </p>
            <p className="category-subtitle">{selectedCategory.contextHint}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="process-form">
          <div className="form-group">
            <label htmlFor="name">Process Name *</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder={categoryContext.placeholder}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description *</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              placeholder="Brief overview of this process — who's involved, what steps does it take, what's the end goal?"
            />
            <small>A 2-3 sentence summary of how this process works</small>
          </div>

          <div className="form-group">
            <label htmlFor="problemStatement">What's not working? *</label>
            <textarea
              id="problemStatement"
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              required
              rows={4}
              placeholder={selectedCategory ? `What makes this ${selectedCategory.label.toLowerCase()} difficult?` : "What's broken or inefficient about this process?"}
            />
            <small>Describe the pain points and challenges you're experiencing</small>
          </div>

          <div className="form-group">
            <label htmlFor="context">Context (Optional)</label>
            <textarea
              id="context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={4}
              placeholder="Team size, budget constraints, organizational structure, urgency, stakeholders involved, etc."
            />
            <small>Anything that helps us understand your situation better</small>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? 'Creating...' : 'Create Process'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}