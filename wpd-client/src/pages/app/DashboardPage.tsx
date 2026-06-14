import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { processApi } from '../../api/processApi';
import { useWpdAuth } from '../../features/auth/AuthContext';
import { useState } from 'react';
import CreateProcessModal from '../../components/modals/CreateProcessModal';

export default function DashboardPage() {
  const { wpdUser: user } = useWpdAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tierLimitError, setTierLimitError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: processes, isLoading } = useQuery({
    queryKey: ['processes'],
    queryFn: processApi.getProcesses,
  });

  const { data: tierLimit } = useQuery({
    queryKey: ['tier-limit'],
    queryFn: processApi.checkTierLimit,
  });

  const handleCreateProcess = () => {
    if (tierLimit && !tierLimit.canCreate) {
      setTierLimitError(
        `You've reached the limit of ${tierLimit.maxAllowed} process(es) for the ${tierLimit.tierName} tier. Upgrade to Pro for unlimited processes.`
      );
      return;
    }
    setShowCreateModal(true);
  };

  const handleDeleteProcess = async (id: number) => {
    if (confirm('Are you sure you want to delete this process?')) {
      try {
        await processApi.deleteProcess(id);
        queryClient.invalidateQueries({ queryKey: ['processes'] });
      } catch (error) {
        console.error('Failed to delete process:', error);
      }
    }
  };

  if (isLoading) {
    return <div className="loading">Loading your processes...</div>;
  }

  return (
    <>
      <CreateProcessModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(processId) => {
          setShowCreateModal(false);
          queryClient.invalidateQueries({ queryKey: ['processes'] });
          navigate(`/processes/${processId}/diagnostic`);
        }}
      />

      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h1>Welcome, {user?.displayName}</h1>
            <p className="tier-badge">
              {user?.subscriptionTierName} Tier
              {tierLimit && (
                <span className="tier-info">
                  {' '}• {tierLimit.currentCount} of {tierLimit.maxAllowed} process(es)
                </span>
              )}
            </p>
          </div>
          <button onClick={handleCreateProcess} className="btn-primary">
            Create Process
          </button>
        </div>

        {tierLimitError && (
          <div className="tier-limit-banner">
            <p>{tierLimitError}</p>
            <button onClick={() => setTierLimitError(null)} className="btn-text">Dismiss</button>
          </div>
        )}

        {processes && processes.length === 0 ? (
          <div className="empty-state">
            <h2>No processes yet</h2>
            <p>Create your first process to start diagnosing with the Four System Lenses</p>
            <button onClick={handleCreateProcess} className="btn-primary">
              Create Process
            </button>
          </div>
        ) : (
          <div className="process-grid">
            {processes?.map((process) => (
              <div key={process.id} className="process-card">
                <div className="process-card-header">
                  <h3>{process.name}</h3>
                  <span className={`status-badge status-${process.status.toLowerCase()}`}>
                    {process.status}
                  </span>
                </div>
                <p className="process-description">{process.description}</p>
                {process.problemStatement && (
                  <div className="process-problem">
                    <strong>Problem:</strong> {process.problemStatement}
                  </div>
                )}
                <div className="process-card-footer">
                  <button
                    onClick={() => navigate(`/processes/${process.id}/diagnostic`)}
                    className="btn-secondary"
                  >
                    Open Diagnostic
                  </button>
                  <button
                    onClick={() => handleDeleteProcess(process.id)}
                    className="btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}