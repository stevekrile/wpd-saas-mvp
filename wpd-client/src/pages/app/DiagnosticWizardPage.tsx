import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { processApi } from '../../api/processApi';
import { clearDraft, loadDraft, saveDraft } from '../../utils/draftStorage';

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
const PROCESS_EDITOR_DRAFT_PREFIX = 'wpd-diagnostic-process-editor-draft';
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

function buildProcessEditorDraftKey(processId: number) {
  return `${PROCESS_EDITOR_DRAFT_PREFIX}-${processId}`;
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
  const queryClient = useQueryClient();
  const { id } = useParams();
  const processId = Number(id);
  const processEditorDraftKey = Number.isFinite(processId) && processId > 0
    ? buildProcessEditorDraftKey(processId)
    : null;
  const [mainTab, setMainTab] = useState<MainTab>('process');
  const [currentLensIndex, setCurrentLensIndex] = useState(0);
  const [ratings, setRatings] = useState<Record<string, Rating | ''>>(getEmptyRatings);
  const [notes, setNotes] = useState<Record<LensKey, string>>(getEmptyNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showProcessEditor, setShowProcessEditor] = useState(false);
  const [processFormError, setProcessFormError] = useState<string | null>(null);
  const [processForm, setProcessForm] = useState({
    name: '',
    description: '',
    problemStatement: '',
    context: '',
  });

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
      const draft = loadDraft<{
        ratings?: Record<string, Rating | ''>;
        notes?: Record<LensKey, string>;
        currentLensIndex?: number;
      }>(buildStorageKey(processId));

      try {
        const diagnostic = await processApi.loadDiagnostic(processId);
        const loadedRatings: Record<string, Rating | ''> = getEmptyRatings();
        const loadedNotes: Record<LensKey, string> = getEmptyNotes();

        diagnostic.questions.forEach((q) => {
          const localId = Object.entries(QUESTION_ID_MAP).find(([_, id]) => id === q.questionId)?.[0];
          if (localId && q.numericResponse > 0) {
            loadedRatings[localId] = q.numericResponse as Rating;
          }
        });

        diagnostic.lensNotes.forEach((note) => {
          if (note.lensKey in loadedNotes) {
            loadedNotes[note.lensKey as LensKey] = note.noteText ?? '';
          }
        });

        if (draft?.ratings) {
          Object.entries(draft.ratings).forEach(([questionId, rating]) => {
            if (typeof rating === 'number') {
              loadedRatings[questionId] = rating;
            }
          });
        }

        if (draft?.notes) {
          Object.entries(draft.notes).forEach(([lensKey, noteText]) => {
            loadedNotes[lensKey as LensKey] = noteText;
          });
        }

        setRatings(loadedRatings);
        setNotes(loadedNotes);

        if (typeof draft?.currentLensIndex === 'number' && draft.currentLensIndex >= 0) {
          setCurrentLensIndex(Math.min(draft.currentLensIndex, LENS_STEPS.length - 1));
        }
      } catch (error) {
        console.warn('Failed to load diagnostic from API, using local draft if available', error);

        if (draft?.ratings) {
          setRatings((prev) => ({ ...prev, ...draft.ratings }));
        }
        if (draft?.notes) {
          setNotes((prev) => ({ ...prev, ...draft.notes }));
        }
        if (typeof draft?.currentLensIndex === 'number' && draft.currentLensIndex >= 0) {
          setCurrentLensIndex(Math.min(draft.currentLensIndex, LENS_STEPS.length - 1));
        }
      }
    };

    loadPersistedDiagnostic();
  }, [processId]);

  useEffect(() => {
    if (!Number.isFinite(processId) || processId <= 0) {
      return;
    }

    saveDraft(buildStorageKey(processId), {
      ratings,
      notes,
      currentLensIndex,
    });
  }, [currentLensIndex, notes, processId, ratings]);

  useEffect(() => {
    const handleOpenHelp = () => setShowHelp(true);
    window.addEventListener('wpd:open-diagnostic-help', handleOpenHelp);
    return () => window.removeEventListener('wpd:open-diagnostic-help', handleOpenHelp);
  }, []);

  useEffect(() => {
    if (!process) {
      return;
    }

    setProcessForm({
      name: process.name ?? '',
      description: process.description ?? '',
      problemStatement: process.problemStatement ?? '',
      context: process.context ?? '',
    });
  }, [process]);

  useEffect(() => {
    if (!showProcessEditor || !processEditorDraftKey) {
      return;
    }

    saveDraft(processEditorDraftKey, processForm);
  }, [processEditorDraftKey, processForm, showProcessEditor]);

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

  const handleLensNoteBlur = async (lensKey: LensKey, noteText: string) => {
    if (!Number.isFinite(processId) || processId <= 0) {
      return;
    }

    setSaveError(null);

    try {
      await processApi.saveDiagnosticLensNote(processId, lensKey, {
        noteText,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to save note. Your note is saved locally.';
      setSaveError(errorMsg);
      console.error('Failed to save diagnostic note:', error);
    }
  };

  const updateProcessMutation = useMutation({
    mutationFn: async () => {
      await processApi.updateProcess(processId, processForm);
    },
    onSuccess: async () => {
      if (processEditorDraftKey) {
        clearDraft(processEditorDraftKey);
      }
      await queryClient.invalidateQueries({ queryKey: ['process', processId] });
      await queryClient.invalidateQueries({ queryKey: ['processes'] });
      setShowProcessEditor(false);
      setProcessFormError(null);
    },
    onError: () => {
      setProcessFormError('Failed to save process details. Please try again.');
    },
  });

  const openProcessEditor = () => {
    if (!process) {
      return;
    }

    const fallbackProcessForm = {
      name: process.name ?? '',
      description: process.description ?? '',
      problemStatement: process.problemStatement ?? '',
      context: process.context ?? '',
    };

    const draft = processEditorDraftKey ? loadDraft<typeof processForm>(processEditorDraftKey) : null;
    setProcessForm(draft ?? fallbackProcessForm);
    setProcessFormError(null);
    setShowProcessEditor(true);
  };

  const saveProcessDetails = () => {
    if (!processForm.name.trim() || !processForm.description.trim() || !processForm.problemStatement.trim()) {
      setProcessFormError('Name, description, and problem statement are required.');
      return;
    }

    updateProcessMutation.mutate();
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
              The WPD Lens Diagnostic gives you a structured, repeatable way to assess the health of any business process — across the four systems that make processes succeed or fail.
            </p>
            <ol className="help-modal-steps">
              <li>
                <strong>Describe the process</strong>
                <p>Start by entering basic context: the process name, owner, and a brief description. This anchors the diagnostic to a specific workflow.</p>
              </li>
              <li>
                <strong>Answer lens questions</strong>
                <p>Rate each question 1–5 across four system lenses: Business Systems, Information Systems, People Systems, and Organizational Systems. Each lens probes a distinct dimension of process health. Answer honestly — there are no wrong answers.</p>
              </li>
              <li>
                <strong>Review your analysis</strong>
                <p>The Summary tab shows your scores as a radar chart alongside a narrative analysis. WPD identifies your weakest lens, surfaces patterns, and recommends where to focus improvement efforts.</p>
              </li>
            </ol>
            <p className="help-modal-footer">
              💡 <strong>Pro tip:</strong> The Pro model unlocks deeper questions per lens and generates a full written diagnostic report you can share with stakeholders.
            </p>
          </div>
        </div>
      )}

      {showProcessEditor && (
        <div className="modal-overlay" onClick={() => setShowProcessEditor(false)}>
          <div className="modal-content process-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit process details</h2>
            </div>
            <div className="modal-form">
              <div className="form-group">
                <label htmlFor="diag-proc-name">Process Name *</label>
                <input
                  id="diag-proc-name"
                  type="text"
                  value={processForm.name}
                  onChange={(e) => setProcessForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="diag-proc-desc">Description *</label>
                <textarea
                  id="diag-proc-desc"
                  rows={3}
                  value={processForm.description}
                  onChange={(e) => setProcessForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="diag-proc-problem">Problem Statement *</label>
                <textarea
                  id="diag-proc-problem"
                  rows={3}
                  value={processForm.problemStatement}
                  onChange={(e) => setProcessForm((prev) => ({ ...prev, problemStatement: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="diag-proc-context">Context</label>
                <textarea
                  id="diag-proc-context"
                  rows={3}
                  value={processForm.context}
                  onChange={(e) => setProcessForm((prev) => ({ ...prev, context: e.target.value }))}
                />
              </div>
              {processFormError && <div className="error-message">{processFormError}</div>}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowProcessEditor(false)}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={saveProcessDetails} disabled={updateProcessMutation.isPending}>
                  {updateProcessMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
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
              <dl className="process-read-view">
                <div className="process-read-row">
                  <dt>Name</dt>
                  <dd>{process.name}</dd>
                </div>
                {process.description && (
                  <div className="process-read-row">
                    <dt>Description</dt>
                    <dd>{process.description}</dd>
                  </div>
                )}
                {process.problemStatement && (
                  <div className="process-read-row">
                    <dt>Problem Statement</dt>
                    <dd>{process.problemStatement}</dd>
                  </div>
                )}
                {process.context && (
                  <div className="process-read-row">
                    <dt>Context</dt>
                    <dd>{process.context}</dd>
                  </div>
                )}
              </dl>
              <div className="diagnostic-actions">
                <button className="btn-secondary" onClick={openProcessEditor}>
                  Edit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {mainTab === 'diagnostic' && (
        <div className="diagnostic-tab-content diagnostic-tab-content-full">
          <div className="diagnostic-layout">
            <div className="diagnostic-question-column">
              <div className="diagnostic-active-lens-block diagnostic-active-lens-block-left" aria-live="polite">
                <h3 className="diagnostic-active-lens-title">{activeLens.title}</h3>
              </div>
              <section className="diagnostic-card">
                <div className="diagnostic-card-header">
                  <p className="diagnostic-pro-hint">💡 Pro model includes more questions for deeper insights</p>
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
                    rows={3}
                    value={notes[activeLens.key]}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [activeLens.key]: e.target.value }))}
                    onBlur={(e) => void handleLensNoteBlur(activeLens.key, e.target.value)}
                    placeholder="Add anything that is not captured by the rating questions."
                  />
                </div>

              </section>
            </div>

            <aside className="diagnostic-radar-column">
              <div className="diagnostic-score-panel" aria-label="Lens score comparison">
                {LENS_STEPS.map((lens, index) => {
                  const average = lensAverages[index].average;
                  const valueText = average > 0 ? average.toFixed(1) : '—';

                  return (
                    <div key={lens.key} className={`diagnostic-score-row ${index === currentLensIndex ? 'active' : ''}`}>
                      <button
                        type="button"
                        className={`diagnostic-lens-tab diagnostic-score-lens-button ${index === currentLensIndex ? 'active' : ''}`}
                        onClick={() => setCurrentLensIndex(index)}
                        aria-label={`Select ${lens.title}`}
                      >
                        <span className="diagnostic-lens-tab-circle">
                          <img src={LENS_TAB_ICONS[lens.key as LensKey]} alt="" className="diagnostic-lens-tab-image" />
                        </span>
                      </button>
                      <div className="diagnostic-score-content">
                        <div className="diagnostic-score-header">
                          <span className="diagnostic-score-title">{lens.title}</span>
                          <span className="diagnostic-score-value">{valueText}/5</span>
                        </div>
                        <div className="diagnostic-score-track">
                          <div
                            className="diagnostic-score-fill"
                            style={{
                              width: `${(average / 5) * 100}%`,
                              background: `linear-gradient(90deg, ${LENS_COLORS[lens.key]}, ${LENS_COLORS[lens.key]}CC)`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>
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

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
