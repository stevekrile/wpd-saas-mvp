import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { processApi } from '../../api/processApi';

export default function CreateProcessPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [context, setContext] = useState('');
  const [error, setError] = useState('');

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
    <div className="create-process">
      <div className="page-header">
        <h1>Create New Process</h1>
        <button onClick={() => navigate('/dashboard')} className="btn-text">
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="process-form">
        <div className="form-group">
          <label htmlFor="name">Process Name *</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g., Customer Onboarding Process"
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
            placeholder="Brief overview of this process"
          />
        </div>

        <div className="form-group">
          <label htmlFor="problemStatement">Problem Statement *</label>
          <textarea
            id="problemStatement"
            value={problemStatement}
            onChange={(e) => setProblemStatement(e.target.value)}
            required
            rows={4}
            placeholder="What's broken or inefficient about this process?"
          />
          <small>Describe the pain points and challenges you're experiencing</small>
        </div>

        <div className="form-group">
          <label htmlFor="context">Context</label>
          <textarea
            id="context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={4}
            placeholder="Additional context about your organization, team size, constraints, etc."
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
  );
}