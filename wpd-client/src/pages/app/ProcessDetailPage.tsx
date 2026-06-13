import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { processApi } from '../../api/processApi';

type ProcessStatus = 'Draft' | 'Active' | 'Archived';

export default function ProcessDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const processId = Number(id);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    problemStatement: '',
    context: '',
    status: 'Draft' as ProcessStatus,
  });

  const { data: process, isLoading, isError } = useQuery({
    queryKey: ['process', processId],
    queryFn: () => processApi.getProcess(processId),
    enabled: Number.isFinite(processId) && processId > 0,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await processApi.updateProcess(processId, formData);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['process', processId] });
      await queryClient.invalidateQueries({ queryKey: ['processes'] });
      setIsEditing(false);
      setError('');
    },
    onError: () => {
      setError('Failed to save changes. Please try again.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await processApi.deleteProcess(processId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['processes'] });
      navigate('/dashboard');
    },
    onError: () => {
      setError('Failed to delete process. Please try again.');
    },
  });

  const startEdit = () => {
    if (!process) {
      return;
    }

    setFormData({
      name: process.name,
      description: process.description,
      problemStatement: process.problemStatement ?? '',
      context: process.context ?? '',
      status: (process.status as ProcessStatus) ?? 'Draft',
    });
    setError('');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setError('');
    setIsEditing(false);
  };

  const saveEdit = () => {
    if (!formData.name.trim() || !formData.description.trim() || !formData.problemStatement.trim()) {
      setError('Name, description, and problem statement are required.');
      return;
    }

    updateMutation.mutate();
  };

  const handleDelete = () => {
    if (confirm('Delete this process? This cannot be undone.')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return <div className="loading">Loading process details...</div>;
  }

  if (isError || !process) {
    return (
      <div className="process-detail-page">
        <div className="process-form">
          <h1>Process not found</h1>
          <p>This process could not be loaded. It may have been deleted or you may not have access.</p>
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="process-detail-page">
      <div className="page-header">
        <h1>{process.name}</h1>
        <button className="btn-secondary" onClick={() => navigate('/dashboard')}>
          Back
        </button>
      </div>

      <div className="process-form">
        {isEditing ? (
          <>
            <div className="form-group">
              <label htmlFor="name">Process Name *</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description *</label>
              <textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="problemStatement">Problem Statement *</label>
              <textarea
                id="problemStatement"
                rows={4}
                value={formData.problemStatement}
                onChange={(e) => setFormData((prev) => ({ ...prev, problemStatement: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="context">Context</label>
              <textarea
                id="context"
                rows={4}
                value={formData.context}
                onChange={(e) => setFormData((prev) => ({ ...prev, context: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as ProcessStatus }))}
              >
                <option value="Draft">Draft</option>
                <option value="Active">Active</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={cancelEdit}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={saveEdit} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="detail-row">
              <span className={`status-badge status-${process.status.toLowerCase()}`}>{process.status}</span>
            </div>

            <div className="detail-section">
              <h3>Description</h3>
              <p>{process.description}</p>
            </div>

            <div className="detail-section">
              <h3>Problem Statement</h3>
              <p>{process.problemStatement || 'No problem statement provided yet.'}</p>
            </div>

            <div className="detail-section">
              <h3>Context</h3>
              <p>{process.context || 'No context provided yet.'}</p>
            </div>

            <div className="detail-meta">
              <span>Created: {new Date(process.createdAt).toLocaleString()}</span>
              <span>Updated: {new Date(process.updatedAt).toLocaleString()}</span>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={startEdit}>
                Edit
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
