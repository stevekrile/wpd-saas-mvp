import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { processApi } from '../../api/processApi';
import ProcessDiscoveryModal, { type ProcessCategory, PROCESS_CATEGORIES } from '../../components/modals/ProcessDiscoveryModal';
import { clearDraft, loadDraft, saveDraft } from '../../utils/draftStorage';

// Category-specific guidance for form fields
const CATEGORY_GUIDANCE: Record<string, {
  label: string;
  icon: string;
  contextHint: string;
  nameHelp: string;
  namePlaceholder: string;
  descriptionHelp: string;
  descriptionPlaceholder: string;
  problemHelp: string;
  problemPlaceholder: string;
  contextHelp: string;
  contextPlaceholder: string;
}> = {
  'customer-facing': {
    label: 'Customer-Facing Process',
    icon: '👥',
    contextHint: 'Think about a process where your customer feels the gaps',
    nameHelp: 'The specific customer-facing process you want to improve',
    namePlaceholder: 'e.g., Customer Onboarding, Account Setup, Support Ticket Resolution',
    descriptionHelp: 'Who interacts with this process? How many steps? What does successful completion look like?',
    descriptionPlaceholder: 'E.g., "New customers go through email verification, profile setup, and first login. Success is a working account within 10 minutes."',
    problemHelp: 'Where is the customer experience breaking down? What frustrations are they experiencing?',
    problemPlaceholder: 'E.g., "Customers hit errors during signup, give up on profile completion, and many never reach first login."',
    contextHelp: 'Customer volume, SLAs, teams involved, tool stack, regulatory constraints, etc.',
    contextPlaceholder: 'E.g., "1,000 signups/month. Engineering, Product, Support teams. Must comply with GDPR."'
  },
  'internal-ops': {
    label: 'Internal Operations',
    icon: '⚙️',
    contextHint: 'Think about a process where work gets stuck or repeated',
    nameHelp: 'The operational process you want to diagnose',
    namePlaceholder: 'e.g., Hiring Workflow, Expense Approval, Procurement Process',
    descriptionHelp: 'Who starts it? Who completes it? What approvals are needed? What tool(s) are used?',
    descriptionPlaceholder: 'E.g., "HR posts job, engineering reviews applications, hiring manager interviews, offer sent to legal. Uses LinkedIn, Greenhouse, email, and Slack."',
    problemHelp: 'Where do things get stuck? What causes delays, rework, or frustration?',
    problemPlaceholder: 'E.g., "Approval step takes 2 weeks. Job postings get lost between systems. No one knows where an application is."',
    contextHelp: 'Team size, number of locations, systems used, compliance requirements, typical volume, etc.',
    contextPlaceholder: 'E.g., "50-person company. 3 offices. 10-15 hires/year. Uses 5 different tools."'
  },
  'team-workflow': {
    label: 'Team Workflow',
    icon: '👫',
    contextHint: 'Think about a process where your team struggles with clarity or coordination',
    nameHelp: 'The daily or recurring team workflow you want to improve',
    namePlaceholder: 'e.g., Sprint Planning, Code Review, Daily Standup, Project Kickoff',
    descriptionHelp: 'How often does it happen? Who is involved? How long does it take? What is the expected output?',
    descriptionPlaceholder: 'E.g., "Weekly 2-hour sprint planning. 6 engineers + product manager. Outputs sprint board with prioritized tickets. Uses Jira + Figma."',
    problemHelp: 'Where does the team struggle? Unclear expectations? Poor communication? Too many steps?',
    problemPlaceholder: 'E.g., "Meetings run over. Priorities change mid-sprint. No one agrees on the definition of done. PMs and engineers talk past each other."',
    contextHelp: 'Team size, experience level, time zones, tools, constraints, strategic goals, etc.',
    contextPlaceholder: 'E.g., "8 engineers, 2 junior. Remote + office hybrid. Distributed across 2 time zones. Ship every 2 weeks."'
  },
  'cross-functional': {
    label: 'Cross-Functional Process',
    icon: '🔗',
    contextHint: 'Think about a process where teams struggle to work together',
    nameHelp: 'The cross-functional initiative or process you want to diagnose',
    namePlaceholder: 'e.g., Product Launch, Budget Planning, Incident Response, Quarterly Planning',
    descriptionHelp: 'Which teams are involved? How long does it take? What does success look like? How do teams coordinate?',
    descriptionPlaceholder: 'E.g., "Product launch: 3 months from kickoff to go-live. Involves Product, Engineering, Design, Marketing, Sales, Support. Success is all teams aligned and launching together."',
    problemHelp: 'Where do teams misalign? Communication breakdowns? Conflicting goals? Unclear ownership?',
    problemPlaceholder: 'E.g., "Marketing starts campaigns before engineering is ready. Sales promises features we can\'t build. No one owns the launch timeline. Teams blame each other when things slip."',
    contextHelp: 'Teams involved, decision-making structure, timeline constraints, stakeholders, dependencies, past launch issues, etc.',
    contextPlaceholder: 'E.g., "5 teams. No clear DRI. 3-month constraint. Last 2 launches slipped 2+ weeks. Sales and Product rarely agree."'
  },
};

const CREATE_PROCESS_DRAFT_KEY = 'wpd-create-process-draft';

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

  useEffect(() => {
    const draft = loadDraft<{
      name?: string;
      description?: string;
      problemStatement?: string;
      context?: string;
    }>(CREATE_PROCESS_DRAFT_KEY);

    if (!draft) {
      return;
    }

    const timer = window.setTimeout(() => {
      setName(draft.name ?? '');
      setDescription(draft.description ?? '');
      setProblemStatement(draft.problemStatement ?? '');
      setContext(draft.context ?? '');
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  // Load category from URL on mount
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      const found = PROCESS_CATEGORIES.find((c) => c.id === categoryParam);
      const timer = window.setTimeout(() => {
        if (found) {
          setSelectedCategory(found);
        } else {
          setShowDiscoveryModal(true);
        }
      }, 0);
      return () => window.clearTimeout(timer);
    } else {
      const timer = window.setTimeout(() => {
        setShowDiscoveryModal(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [searchParams]);

  useEffect(() => {
    saveDraft(CREATE_PROCESS_DRAFT_KEY, {
      name,
      description,
      problemStatement,
      context,
    });
  }, [context, description, name, problemStatement]);

  const handleSelectCategory = (category: ProcessCategory) => {
    setSelectedCategory(category);
    setShowDiscoveryModal(false);
    navigate(`/processes/create?category=${category.id}`);
  };

  const guidance = selectedCategory 
    ? CATEGORY_GUIDANCE[selectedCategory.id] 
    : CATEGORY_GUIDANCE['customer-facing'];

  const createMutation = useMutation({
    mutationFn: processApi.createProcess,
    onSuccess: (process) => {
      clearDraft(CREATE_PROCESS_DRAFT_KEY);
      navigate(`/processes/${process.id}/diagnostic`);
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        const upgradePrompt = (err.response.data as { upgradePrompt?: string } | undefined)?.upgradePrompt;
        setError(upgradePrompt ?? 'Process limit reached.');
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
            <div className="form-group-header">
              <label htmlFor="name">Process Name *</label>
              <small>{guidance.nameHelp}</small>
            </div>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder={guidance.namePlaceholder}
            />
          </div>

          <div className="form-group">
            <div className="form-group-header">
              <label htmlFor="description">Description *</label>
              <small>{guidance.descriptionHelp}</small>
            </div>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              placeholder={guidance.descriptionPlaceholder}
            />
          </div>

          <div className="form-group">
            <div className="form-group-header">
              <label htmlFor="problemStatement">What's not working? *</label>
              <small>{guidance.problemHelp}</small>
            </div>
            <textarea
              id="problemStatement"
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              required
              rows={4}
              placeholder={guidance.problemPlaceholder}
            />
          </div>

          <div className="form-group">
            <div className="form-group-header">
              <label htmlFor="context">Context (Optional)</label>
              <small>{guidance.contextHelp}</small>
            </div>
            <textarea
              id="context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={4}
              placeholder={guidance.contextPlaceholder}
            />
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