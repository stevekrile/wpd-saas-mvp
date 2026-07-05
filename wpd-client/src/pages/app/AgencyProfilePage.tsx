import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { agencyApi } from '../../api/agencyApi';

type LensKey = 'business' | 'information' | 'human' | 'organizational';

const AGENCY_SCALE = [1, 2, 3, 4, 5];
const LENS_ORDER: LensKey[] = ['business', 'information', 'human', 'organizational'];
const LENS_TAB_ICONS: Record<LensKey, string> = {
  business: '/images/lens-business-tab-icon.svg',
  information: '/images/lens-information-tab-icon.svg',
  human: '/images/lens-human-tab-icon.svg',
  organizational: '/images/lens-organizational-tab-icon.svg',
};
const LENS_COLORS: Record<LensKey, string> = {
  business: '#0066CC',
  information: '#00AA44',
  human: '#FF9900',
  organizational: '#9933CC',
};

function toLensKey(value: string): LensKey | null {
  if (value === 'business' || value === 'information' || value === 'human' || value === 'organizational') {
    return value;
  }
  return null;
}

export default function AgencyProfilePage() {
  const queryClient = useQueryClient();
  const [currentLensIndex, setCurrentLensIndex] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['agency-profile'],
    queryFn: agencyApi.getAgencyProfile,
  });

  const orderedLenses = useMemo(() => {
    if (!profile) {
      return [];
    }

    return LENS_ORDER
      .map((key) => profile.lenses.find((lens) => lens.lensKey === key))
      .filter((lens): lens is NonNullable<typeof lens> => Boolean(lens));
  }, [profile]);

  useEffect(() => {
    if (orderedLenses.length === 0) {
      return;
    }

    if (currentLensIndex >= orderedLenses.length) {
      setCurrentLensIndex(0);
    }
  }, [currentLensIndex, orderedLenses.length]);

  const activeLens = orderedLenses[currentLensIndex] ?? null;

  const saveMutation = useMutation({
    mutationFn: async (params: { lensKey: string; statementNumber: number; score: number }) => {
      return agencyApi.saveStatementScore(params.lensKey, params.statementNumber, params.score);
    },
    onSuccess: async () => {
      setSaveError(null);
      await queryClient.invalidateQueries({ queryKey: ['agency-profile'] });
    },
    onError: (error) => {
      if (axios.isAxiosError(error)) {
        const apiError = (error.response?.data as { error?: string } | undefined)?.error;
        setSaveError(apiError ?? 'Failed to save your agency score. Please try again.');
        return;
      }

      setSaveError('Failed to save your agency score. Please try again.');
    },
  });

  if (isLoading) {
    return <div className="loading">Loading your Agency Profile...</div>;
  }

  if (isError || !profile) {
    return (
      <div className="empty-state">
        <h2>Unable to load Agency Profile</h2>
        <p>Please refresh and try again.</p>
      </div>
    );
  }

  return (
    <div className="agency-profile-page">
      <div className="agency-header">
        <div>
          <h1>Agency Profile</h1>
          <p>
            Score each statement from 1 (low agency) to 5 (high agency). You can answer as few as one or as many as
            five statements per lens.
          </p>
        </div>
      </div>

      {saveError && (
        <div className="diagnostic-error-banner" role="alert">
          <p>{saveError}</p>
          <button onClick={() => setSaveError(null)} className="btn-icon" aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      <div className="diagnostic-tab-content diagnostic-tab-content-full">
        <div className="diagnostic-layout">
          <section className="diagnostic-mobile-lens-switcher" aria-label="Agency lens selector">
            <div className="diagnostic-mobile-lens-switcher-grid">
              {orderedLenses.map((lens, index) => {
                const lensKey = toLensKey(lens.lensKey);
                if (!lensKey) {
                  return null;
                }

                const valueText = lens.agencyScore !== null ? lens.agencyScore.toFixed(1) : '—';

                return (
                  <button
                    key={lens.lensKey}
                    type="button"
                    className={`diagnostic-mobile-lens-button ${index === currentLensIndex ? 'active' : ''}`}
                    onClick={() => setCurrentLensIndex(index)}
                    aria-label={`Select ${lens.lensName}`}
                  >
                    <span className={`diagnostic-mobile-lens-icon ${index === currentLensIndex ? 'active' : ''}`}>
                      <span className="diagnostic-mobile-lens-icon-mask">
                        <img src={LENS_TAB_ICONS[lensKey]} alt="" className="diagnostic-mobile-lens-image" />
                      </span>
                    </span>
                    <span className="diagnostic-mobile-lens-value">{valueText}/5</span>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="diagnostic-radar-column">
            <div className="diagnostic-score-panel" aria-label="Agency lens score comparison">
              {orderedLenses.map((lens, index) => {
                const lensKey = toLensKey(lens.lensKey);
                if (!lensKey) {
                  return null;
                }

                const valueText = lens.agencyScore !== null ? lens.agencyScore.toFixed(1) : '—';
                const fillPercent = lens.agencyScore !== null ? (lens.agencyScore / 5) * 100 : 0;

                return (
                  <div key={lens.lensKey} className={`diagnostic-score-row ${index === currentLensIndex ? 'active' : ''}`}>
                    <button
                      type="button"
                      className={`diagnostic-lens-tab diagnostic-score-lens-button ${index === currentLensIndex ? 'active' : ''}`}
                      onClick={() => setCurrentLensIndex(index)}
                      aria-label={`Select ${lens.lensName}`}
                    >
                      <span className="diagnostic-lens-tab-circle">
                        <img src={LENS_TAB_ICONS[lensKey]} alt="" className="diagnostic-lens-tab-image" />
                      </span>
                    </button>
                    <div className="diagnostic-score-content">
                      <div className="diagnostic-score-header">
                        <span className="diagnostic-score-title">{lens.lensName}</span>
                        <span className="diagnostic-score-value">{valueText}/5</span>
                      </div>
                      <div className="diagnostic-score-track">
                        <div
                          className="diagnostic-score-fill"
                          style={{
                            width: `${fillPercent}%`,
                            background: `linear-gradient(90deg, ${LENS_COLORS[lensKey]}, ${LENS_COLORS[lensKey]}CC)`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <div className="diagnostic-question-column">
            {activeLens && (
              <>
                <div className="diagnostic-active-lens-block diagnostic-active-lens-block-left" aria-live="polite">
                  <h3 className="diagnostic-active-lens-title">{activeLens.lensName}</h3>
                </div>

                <section className="diagnostic-card diagnostic-question-panel">
                  <div className="diagnostic-question-list">
                    {activeLens.statements.map((statement) => (
                      <div key={`${activeLens.lensKey}-${statement.statementNumber}`} className="diagnostic-question-card">
                        <div className="diagnostic-question-copy">
                          <h3>{statement.statementText}</h3>
                        </div>
                        <div className="diagnostic-scale" role="radiogroup" aria-label={`Statement ${statement.statementNumber}`}>
                          {AGENCY_SCALE.map((score) => (
                            <button
                              key={score}
                              type="button"
                              className={`diagnostic-scale-option ${statement.score === score ? 'active' : ''}`}
                              onClick={() =>
                                saveMutation.mutate({
                                  lensKey: activeLens.lensKey,
                                  statementNumber: statement.statementNumber,
                                  score,
                                })
                              }
                              disabled={saveMutation.isPending}
                              aria-pressed={statement.score === score}
                              aria-label={`Statement ${statement.statementNumber} score ${score}`}
                            >
                              {score}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
