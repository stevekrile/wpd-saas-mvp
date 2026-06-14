import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { processApi } from '../../api/processApi';
import { LensRadarChart } from '../../components/LensRadarChart';

type LensKey = 'business' | 'information' | 'human' | 'organizational';
type Rating = 1 | 2 | 3 | 4 | 5;
type MainTab = 'process' | 'diagnostic' | 'summary';

interface DiagnosticQuestion {
  id: string;
  prompt: string;
  help: string;
}

interface LensStep {
  key: LensKey;
  title: string;
  image: string;
  intro: string;
  questions: DiagnosticQuestion[];
}

const LENS_COLORS: Record<LensKey, string> = {
  business: '#0066CC',    // Strong blue
  information: '#00AA44',  // Strong green
  human: '#FF9900',        // Strong orange
  organizational: '#9933CC', // Strong purple
};

const LENS_ICON_IMAGES: Record<LensKey, string> = {
  business: '/images/lens-business-icon.svg',
  information: '/images/lens-information-icon.svg',
  human: '/images/lens-human-icon.svg',
  organizational: '/images/lens-organizational-icon.svg',
};

const LENS_TAB_ICONS: Record<LensKey, string> = {
  business: '/images/lens-business-tab-icon.svg',
  information: '/images/lens-information-tab-icon.svg',
  human: '/images/lens-human-tab-icon.svg',
  organizational: '/images/lens-organizational-tab-icon.svg',
};

const LENS_STEPS: LensStep[] = [
  {
    key: 'business',
    title: 'Business Systems',
    image: '/images/lens-business-tab-icon.svg',
    intro: 'Rules, policies, standards, and how clearly the process is governed.',
    questions: [
      {
        id: 'business-1',
        prompt: 'Business rules for this process are clearly documented and easy to find.',
        help: 'Think about whether the work depends on tribal knowledge or written rules.',
      },
      {
        id: 'business-2',
        prompt: 'There is clear ownership and authority over business rules and decisions.',
        help: 'Who can change the rules, approve exceptions, or settle disputes?',
      },
      {
        id: 'business-3',
        prompt: 'Business rules are applied consistently across teams, locations, and situations.',
        help: 'Look for variation caused by people improvising or interpreting the rules differently.',
      },
    ],
  },
  {
    key: 'information',
    title: 'Information Systems',
    image: '/images/lens-information-tab-icon.svg',
    intro: 'The data, technology, and reporting that support the process.',
    questions: [
      {
        id: 'information-1',
        prompt: 'The data model is well-designed for the information we need to capture.',
        help: 'Are fields, records, and systems structured in a way that makes sense?',
      },
      {
        id: 'information-2',
        prompt: 'Data acquisition is easy and does not require significant workarounds.',
        help: 'Can people get the data into the system without friction or extra steps?',
      },
      {
        id: 'information-3',
        prompt: 'Data quality is validated and errors are caught early in the process.',
        help: 'Think about missing, wrong, or late information and where it gets caught.',
      },
    ],
  },
  {
    key: 'human',
    title: 'People Systems',
    image: '/images/lens-human-tab-icon.svg',
    intro: 'Skills, behavior, capacity, and change readiness.',
    questions: [
      {
        id: 'human-1',
        prompt: 'People doing this work have the skills and tools to perform it well.',
        help: 'Consider training gaps, tool proficiency, and ongoing support.',
      },
      {
        id: 'human-2',
        prompt: 'People have the time and capacity to execute this process without stress.',
        help: 'Is workload reasonable? Are there bottlenecks or handoff delays?',
      },
      {
        id: 'human-3',
        prompt: 'There is alignment and motivation across all parties involved.',
        help: 'Do incentives conflict? Are goals clear and shared?',
      },
    ],
  },
  {
    key: 'organizational',
    title: 'Organizational Systems',
    image: '/images/lens-organizational-tab-icon.svg',
    intro: 'Structure, governance, and resources that enable execution.',
    questions: [
      {
        id: 'organizational-1',
        prompt: 'Roles, responsibilities, and decision rights are clearly defined.',
        help: 'Can people easily understand who does what and who decides?',
      },
      {
        id: 'organizational-2',
        prompt: 'The organizational structure supports effective execution of this process.',
        help: 'Do reporting lines and boundaries help or hinder the flow of work?',
      },
      {
        id: 'organizational-3',
        prompt: 'The business values this process enough to provide proper resources and support.',
        help: 'Is this work treated as important, or as overhead?',
      },
    ],
  },
];

const STORAGE_PREFIX = 'wpd-diagnostic-draft';
const QUESTION_ID_MAP: Record<string, number> = {
  'business-1': 1,
  'business-2': 2,
  'business-3': 3,
  'information-1': 4,
  'information-2': 5,
  'information-3': 6,
  'human-1': 7,
  'human-2': 8,
  'human-3': 9,
  'organizational-1': 10,
  'organizational-2': 11,
  'organizational-3': 12,
};

function buildStorageKey(processId: number) {
  return `${STORAGE_PREFIX}-${processId}`;
}

function getEmptyRatings() {
  return LENS_STEPS.flatMap((lens) => lens.questions).reduce<Record<string, Rating | ''>>((acc, question) => {
    acc[question.id] = '';
    return acc;
  }, {});
}

function getEmptyNotes() {
  return LENS_STEPS.reduce<Record<LensKey, string>>((acc, lens) => {
    acc[lens.key] = '';
    return acc;
  }, {} as Record<LensKey, string>);
}

export default function DiagnosticWizardPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const processId = Number(id);
  const [mainTab, setMainTab] = useState<MainTab>('process');
  const [currentLensIndex, setCurrentLensIndex] = useState(0);
  const [ratings, setRatings] = useState<Record<string, Rating | ''>>(getEmptyRatings);
  const [notes, setNotes] = useState<Record<LensKey, string>>(getEmptyNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const { data: process, isLoading, isError } = useQuery({
    queryKey: ['process', processId],
    queryFn: () => processApi.getProcess(processId),
    enabled: Number.isFinite(processId) && processId > 0,
  });

  useEffect(() => {
    if (!Number.isFinite(processId) || processId <= 0) {
      return;
    }

    const loadPersistedDiagnostic = async () => {
      try {
        const diagnostic = await processApi.loadDiagnostic(processId);
        const loadedRatings: Record<string, Rating | ''> = getEmptyRatings();
        
        diagnostic.questions.forEach((q) => {
          const localId = Object.entries(QUESTION_ID_MAP).find(([_, id]) => id === q.questionId)?.[0];
          if (localId && q.numericResponse > 0) {
            loadedRatings[localId] = q.numericResponse as Rating;
          }
        });
        
        setRatings(loadedRatings);
      } catch (error) {
        console.warn('Failed to load diagnostic from API, falling back to localStorage', error);
        const raw = window.localStorage.getItem(buildStorageKey(processId));
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as {
              ratings?: Record<string, Rating | ''>;
              notes?: Record<LensKey, string>;
              currentLensIndex?: number;
            };
            if (parsed.ratings) {
              setRatings((prev) => ({ ...prev, ...parsed.ratings }));
            }
            if (parsed.notes) {
              setNotes((prev) => ({ ...prev, ...parsed.notes }));
            }
            if (typeof parsed.currentLensIndex === 'number' && parsed.currentLensIndex >= 0) {
              setCurrentLensIndex(Math.min(parsed.currentLensIndex, LENS_STEPS.length - 1));
            }
          } catch {
            // Ignore malformed local drafts
          }
        }
      }
    };

    loadPersistedDiagnostic();
  }, [processId]);

  useEffect(() => {
    if (!Number.isFinite(processId) || processId <= 0 || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      buildStorageKey(processId),
      JSON.stringify({
        ratings,
        notes,
        currentLensIndex,
      })
    );
  }, [currentLensIndex, notes, processId, ratings]);

  const activeLens = LENS_STEPS[currentLensIndex];

  const lensAverages = useMemo(() => {
    return LENS_STEPS.map((lens) => {
      const values = lens.questions
        .map((question) => ratings[question.id])
        .filter((value): value is Rating => typeof value === 'number');

      const average = values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0;

      return {
        key: lens.key,
        title: lens.title,
        average,
        color: LENS_COLORS[lens.key as LensKey],
      };
    });
  }, [ratings]);

  const handleRatingChange = async (questionId: string, value: Rating) => {
    setRatings((prev) => ({ ...prev, [questionId]: value }));
    setSaveError(null);
    
    setIsSaving(true);
    try {
      const backendQuestionId = QUESTION_ID_MAP[questionId];
      await processApi.saveDiagnosticResponse(processId, backendQuestionId, {
        numericResponse: value,
        textResponse: '',
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to save response. Your answer is saved locally.';
      setSaveError(errorMsg);
      console.error('Failed to save diagnostic response:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExit = () => {
    navigate(`/processes/${processId}`);
  };

  if (isLoading) {
    return <div className="loading">Loading diagnostic...</div>;
  }

  if (isError || !process) {
    return (
      <div className="diagnostic-page">
        <div className="process-form">
          <h1>Diagnostic not found</h1>
          <p>This process could not be loaded.</p>
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
    <div className="diagnostic-page-v2">
      <div className="diagnostic-help-icon diagnostic-help-icon--breadcrumb" onClick={() => setShowHelp(true)} role="button" aria-label="How this works">
        ?
      </div>
      {/* Header with title and tabs */}
      <div className="diagnostic-header">
        <div className="container">
          <h1>WPD Lens Diagnostic</h1>
          <p className="diagnostic-subtitle">Systematically diagnose process health across four system lenses</p>
        </div>
      </div>

      {/* Main tab navigation */}
      <div className="diagnostic-tab-nav">
        <div className="container">
          <div className="diagnostic-tab-buttons">
            <button
              className={`diagnostic-tab-btn ${mainTab === 'process' ? 'active' : ''}`}
              onClick={() => setMainTab('process')}
            >
              <span className="diagnostic-tab-number">1</span>
              <span className="diagnostic-tab-label">Process</span>
            </button>
            <button
              className={`diagnostic-tab-btn ${mainTab === 'diagnostic' ? 'active' : ''}`}
              onClick={() => setMainTab('diagnostic')}
            >
              <span className="diagnostic-tab-number">2</span>
              <span className="diagnostic-tab-label">Diagnostic</span>
            </button>
            <button
              className={`diagnostic-tab-btn ${mainTab === 'summary' ? 'active' : ''}`}
              onClick={() => setMainTab('summary')}
            >
              <span className="diagnostic-tab-number">3</span>
              <span className="diagnostic-tab-label">Summary</span>
            </button>
          </div>
        </div>
      </div>

      {showHelp && (
        <div className="help-modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <button className="help-modal-close" onClick={() => setShowHelp(false)} aria-label="Close">✕</button>
            <h2>How the WPD Diagnostic Works</h2>
            <p className="help-modal-intro">
              The WPD Lens Diagnostic helps you assess process health across four systems.
            </p>
            <ol className="help-modal-steps">
              <li><strong>Process:</strong> confirm the process details and scope.</li>
              <li><strong>Diagnostic:</strong> rate each lens question from 1-5.</li>
              <li><strong>Summary:</strong> review scores and identify the weakest lens.</li>
            </ol>
          </div>
        </div>
      )}

      {/* Error banner */}
      {saveError && (
        <div className="diagnostic-error-banner" role="alert">
          <p>{saveError}</p>
          <button onClick={() => setSaveError(null)} className="btn-icon" aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      {/* Tab content */}
      <div className="container">
        {mainTab === 'process' && (
          <div className="diagnostic-tab-content">
            <div className="diagnostic-card">
              <div className="diagnostic-card-header">
                <h2>Process Details</h2>
              </div>
              <div className="process-details">
                <div className="detail-field">
                  <label>Process Name</label>
                  <p>{process.name}</p>
                </div>
                <div className="detail-field">
                  <label>Description</label>
                  <p>{process.description}</p>
                </div>
                <div className="detail-field">
                  <label>Problem Statement</label>
                  <p>{process.problemStatement}</p>
                </div>
                <div className="detail-field">
                  <label>Context</label>
                  <p>{process.context}</p>
                </div>
              </div>
              <div className="diagnostic-actions">
                <button className="btn-primary" onClick={() => setMainTab('diagnostic')}>
                  Begin Diagnostic →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {mainTab === 'diagnostic' && (
        <div className="diagnostic-tab-content diagnostic-tab-content-full">
          <div className="diagnostic-layout">
            <div className="diagnostic-main">
                {/* Progress visualization and lens tabs - horizontal row */}
                <div className="diagnostic-controls-row">
                  {/* Lens tabs */}
                  <div className="diagnostic-lens-tabs">
                    {LENS_STEPS.map((lens, index) => (
                      <button
                        key={lens.key}
                        type="button"
                        className={`diagnostic-lens-tab ${index === currentLensIndex ? 'active' : ''}`}
                        onClick={() => setCurrentLensIndex(index)}
                        title={lens.title}
                      >
                        <img src={LENS_TAB_ICONS[lens.key as LensKey]} alt={lens.title} className="diagnostic-lens-tab-image" />
                        <span className="diagnostic-lens-tab-label">{lens.title}</span>
                      </button>
                    ))}
                  </div>

                  <div className="diagnostic-progress-section">
                    <LensRadarChart 
                      lenses={lensAverages.map((l) => ({
                        key: l.key,
                        title: l.title,
                        score: l.average,
                        color: l.color,
                        image: LENS_ICON_IMAGES[l.key as LensKey]
                      }))}
                      size={220}
                    />
                  </div>
                </div>

                {/* Questions card */}
                <section className="diagnostic-card">
                  <div className="diagnostic-card-header">
                    <div>
                      <h2>
                        <img src={activeLens.image} alt={activeLens.title} className="diagnostic-lens-icon-img" />
                        {activeLens.title}
                      </h2>
                      <p>{activeLens.intro}</p>
                      <p className="diagnostic-pro-hint">💡 Pro model includes more questions for deeper insights</p>
                    </div>
                  </div>

                  <div className="diagnostic-question-list">
                    {activeLens.questions.map((question) => (
                      <div key={question.id} className="diagnostic-question-card">
                        <div className="diagnostic-question-copy">
                          <h3>{question.prompt}</h3>
                          <p>{question.help}</p>
                        </div>
                        <div className="diagnostic-scale" role="radiogroup" aria-label={question.prompt}>
                          {[1, 2, 3, 4, 5].map((value) => (
                            <button
                              key={value}
                              type="button"
                              className={`diagnostic-scale-option ${ratings[question.id] === value ? 'active' : ''}`}
                              onClick={() => handleRatingChange(question.id, value as Rating)}
                              disabled={isSaving}
                              aria-pressed={ratings[question.id] === value}
                              aria-label={`${question.prompt} score ${value}`}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="diagnostic-note">
                    <label htmlFor={`${activeLens.key}-notes`}>Optional lens notes</label>
                    <textarea
                      id={`${activeLens.key}-notes`}
                      rows={4}
                      value={notes[activeLens.key]}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [activeLens.key]: e.target.value }))}
                      placeholder="Add anything that is not captured by the rating questions."
                    />
                  </div>

                  <div className="diagnostic-actions">
                    {currentLensIndex > 0 && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setCurrentLensIndex((value) => Math.max(value - 1, 0))}
                      >
                        ← Previous Lens
                      </button>
                    )}
                    {currentLensIndex < LENS_STEPS.length - 1 ? (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => setCurrentLensIndex((value) => Math.min(value + 1, LENS_STEPS.length - 1))}
                      >
                        Next Lens →
                      </button>
                    ) : (
                      <button type="button" className="btn-primary" onClick={() => setMainTab('summary')}>
                        View Summary →
                      </button>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {mainTab === 'summary' && (
        <div className="diagnostic-tab-content">
          <div className="container">
            <div className="diagnostic-card">
              <div className="diagnostic-card-header">
                <h2>Diagnostic Summary</h2>
              </div>
              <div className="summary-content">
                <div className="summary-section">
                  <h3>Overall Lens Scores</h3>
                  <LensRadarChart 
                    lenses={lensAverages.map((l) => ({
                      key: l.key,
                      title: l.title,
                      score: l.average,
                      color: l.color,
                      image: LENS_ICON_IMAGES[l.key as LensKey]
                    }))}
                    size={260}
                  />
                </div>

                <div className="summary-section">
                  <h3>Lens Scores</h3>
                  <div className="lens-scores">
                    {lensAverages.map((lens) => (
                      <div key={lens.key} className="lens-score-item">
                        <div className="lens-score-bar">
                          <div className="lens-score-label">{lens.title}</div>
                          <div className="lens-score-chart">
                            <div 
                              className="lens-score-fill" 
                              style={{ width: `${(lens.average / 5) * 100}%` }}
                            ></div>
                          </div>
                          <div className="lens-score-value">{lens.average > 0 ? lens.average.toFixed(1) : '—'}/5</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="summary-section">
                  <h3>Overview</h3>
                  <p className="summary-placeholder">
                    Summary analysis will appear here after you complete the diagnostic. This will include key patterns, recommendations, and next steps based on your lens ratings.
                  </p>
                </div>

                <div className="diagnostic-actions">
                  <button className="btn-secondary" onClick={() => setMainTab('diagnostic')}>
                    ← Back to Questions
                  </button>
                  <button className="btn-primary" onClick={handleExit}>
                    Return to Process
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
