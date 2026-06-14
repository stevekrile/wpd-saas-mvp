import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { processApi } from '../../api/processApi';
import { useWpdAuth } from '../../features/auth/AuthContext';
import { useState } from 'react';
import ProcessDiscoveryModal, { type ProcessCategory } from '../../components/modals/ProcessDiscoveryModal';

export default function DashboardPage() {
  const { wpdUser: user } = useWpdAuth();
  const navigate = useNavigate();
  const [tierLimitError, setTierLimitError] = useState<string | null>(null);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);

  const { data: processes, isLoading, refetch } = useQuery({
    queryKey: ['processes'],
    queryFn: processApi.getProcesses,
  });

  const { data: tierLimit } = useQuery({
    queryKey: ['tier-limit'],
    queryFn: processApi.checkTierLimit,
  });

  // Show discovery modal on first visit (no processes yet)
  const isFirstTime = processes && processes.length === 0;

  const handleCreateProcess = async () => {
    if (tierLimit && !tierLimit.canCreate) {
      setTierLimitError(
        `You've reached the limit of ${tierLimit.maxAllowed} process(es) for the ${tierLimit.tierName} tier. Upgrade to Pro for unlimited processes.`
      );
      return;
    }
    // If first time, show discovery modal instead of going straight to form
    if (isFirstTime) {
      setShowDiscoveryModal(true);
    } else {
      navigate('/processes/create');
    }
  };

  const handleSelectCategory = (category: ProcessCategory) => {
    setShowDiscoveryModal(false);
    navigate(`/processes/create?category=${category.id}`);
  };

  const handleDeleteProcess = async (id: number) => {
    if (confirm('Are you sure you want to delete this process?')) {
      try {
        await processApi.deleteProcess(id);
        refetch();
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
      {isFirstTime && (
        <ProcessDiscoveryModal
          isOpen={showDiscoveryModal}
          onSelect={handleSelectCategory}
          onClose={() => setShowDiscoveryModal(false)}
        />
      )}

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
            + Create Process
          </button>
        </div>

        {tierLimitError && (
          <div className="tier-limit-banner">
            <p>{tierLimitError}</p>
            <button onClick={() => setTierLimitError(null)} className="btn-text">
              Dismiss
            </button>
          </div>
        )}

        {processes && processes.length === 0 ? (
          <div className="empty-state">
            <h2>No processes yet</h2>
            <p>Create your first process to start diagnosing with the Four System Lenses</p>
            <button onClick={handleCreateProcess} className="btn-primary">
              Create Your First Process
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
                    onClick={() => navigate(`/processes/${process.id}`)}
                    className="btn-secondary"
                  >
                    View Details
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