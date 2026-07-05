import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { processApi } from '../../api/processApi';
import { agencyApi } from '../../api/agencyApi';
import { useWpdAuth } from '../../features/auth/AuthContext';
import { useState } from 'react';
import CreateProcessModal from '../../components/modals/CreateProcessModal';

const LENS_TAB_ICONS: Record<string, string> = {
  business: '/images/lens-business-tab-icon.svg',
  information: '/images/lens-information-tab-icon.svg',
  human: '/images/lens-human-tab-icon.svg',
  organizational: '/images/lens-organizational-tab-icon.svg',
};

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
  const { data: agencyProfile } = useQuery({
    queryKey: ['agency-profile'],
    queryFn: agencyApi.getAgencyProfile,
  });
  const latestProcess = processes && processes.length > 0 ? processes[0] : null;
  const agencyLensScores = [
    { lensKey: 'business', label: 'Business' },
    { lensKey: 'information', label: 'Information' },
    { lensKey: 'human', label: 'People' },
    { lensKey: 'organizational', label: 'Organization' },
  ].map((lens) => {
    const matchingLens = agencyProfile?.lenses.find((item) => item.lensKey === lens.lensKey);
    return {
      ...lens,
      scoreText: matchingLens?.agencyScore !== null && matchingLens?.agencyScore !== undefined
        ? `${matchingLens.agencyScore.toFixed(1)}/5`
        : '—/5',
    };
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
          </div>
        </div>

        {tierLimitError && (
          <div className="tier-limit-banner">
            <p>{tierLimitError}</p>
            <button onClick={() => setTierLimitError(null)} className="btn-text">Dismiss</button>
          </div>
        )}

        <section className="dashboard-module-portal">
          <div className="dashboard-module-grid">
            <article className="dashboard-module-card">
              <h3>Agency Profile</h3>
              <p>Measure your agency across the four lenses to improve AI guidance context.</p>
              <button
                type="button"
                onClick={() => navigate('/agency')}
                className="dashboard-agency-score-row"
                aria-label="Open Agency Profile questionnaire"
              >
                {agencyLensScores.map((lens) => (
                  <span key={lens.lensKey} className="dashboard-agency-score-pill">
                    <span className="dashboard-agency-score-icon-wrap" aria-hidden="true">
                      <img
                        src={LENS_TAB_ICONS[lens.lensKey]}
                        alt=""
                        className="dashboard-agency-score-icon"
                      />
                    </span>
                    <strong>{lens.scoreText}</strong>
                  </span>
                ))}
              </button>
            </article>

            <article className="dashboard-module-card">
              <div className="dashboard-module-card-header">
                <h3>Process Diagnostic</h3>
                <p className="tier-badge dashboard-module-tier-badge">
                  {user?.subscriptionTierName} Tier
                  {tierLimit && (
                    <span className="tier-info">
                      {' '}• {tierLimit.currentCount} of {tierLimit.maxAllowed} process(es)
                    </span>
                  )}
                </p>
              </div>
              <p>Create, run, and manage diagnostics across your active process portfolio.</p>
              <div className="dashboard-module-card-footer">
                <button onClick={handleCreateProcess} className="btn-secondary">
                  New Diagnostic
                </button>
                <button
                  onClick={() => latestProcess && navigate(`/processes/${latestProcess.id}/diagnostic`)}
                  className="btn-secondary"
                  disabled={!latestProcess}
                >
                  {latestProcess ? 'Continue Latest' : 'No Processes Yet'}
                </button>
              </div>
              {processes && processes.length > 0 && (
                <div className="dashboard-module-process-list">
                  {processes.slice(0, 3).map((process) => (
                    <div key={process.id} className="dashboard-module-process-item">
                      <button
                        onClick={() => navigate(`/processes/${process.id}/diagnostic`)}
                        className="btn-text"
                      >
                        {process.name}
                      </button>
                      <button
                        onClick={() => handleDeleteProcess(process.id)}
                        className="btn-text dashboard-module-delete"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>
          {processes && processes.length === 0 && (
            <div className="empty-state">
              <h2>No processes yet</h2>
              <p>Create your first process from the Process Diagnostic module.</p>
              <button onClick={handleCreateProcess} className="btn-primary">
                New Diagnostic
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}