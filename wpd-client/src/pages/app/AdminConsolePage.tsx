import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminApi,
  type AdminAiTokenUsageRow,
  type AdminRecordAccessHistoryRow,
  type AdminUserSummary,
} from '../../api/adminApi';

function utcDateDaysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function toUtcIso(dateValue: string) {
  return new Date(dateValue).toISOString();
}

function formatDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : '—';
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function getApiMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function AdminUserRow({
  user,
  onRefresh,
}: {
  user: AdminUserSummary;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState(user.role);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const updateRoleMutation = useMutation({
    mutationFn: () => adminApi.updateUserRole(user.userId, { role, reason: reason || undefined }),
    onSuccess: () => {
      setReason('');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      onRefresh();
    },
    onError: (mutationError) => setError(getApiMessage(mutationError, 'Failed to update user role.')),
  });

  const deactivateMutation = useMutation({
    mutationFn: () => adminApi.deactivateUser(user.userId, { reason: reason || undefined }),
    onSuccess: () => {
      setReason('');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      onRefresh();
    },
    onError: (mutationError) => setError(getApiMessage(mutationError, 'Failed to deactivate user.')),
  });

  const reactivateMutation = useMutation({
    mutationFn: () => adminApi.reactivateUser(user.userId, { reason: reason || undefined }),
    onSuccess: () => {
      setReason('');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      onRefresh();
    },
    onError: (mutationError) => setError(getApiMessage(mutationError, 'Failed to reactivate user.')),
  });

  return (
    <tr>
      <td>
        <strong>{user.displayName || user.email || user.userId}</strong>
        <div className="admin-muted">{user.userId}</div>
      </td>
      <td>{user.email || '—'}</td>
      <td>{user.workspaceId ?? '—'}</td>
      <td>{user.accountId ?? '—'}</td>
      <td>
        <span className={`status-badge ${user.isActive ? 'status-active' : 'status-archived'}`}>
          {user.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>
        <select value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="User">User</option>
          <option value="Admin">Admin</option>
          <option value="SystemAdmin">SystemAdmin</option>
        </select>
      </td>
      <td>
        <input type="text" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for action" />
      </td>
      <td>
        <div className="admin-table-actions">
          <button type="button" className="btn-secondary" onClick={() => updateRoleMutation.mutate()} disabled={updateRoleMutation.isPending}>
            Save role
          </button>
          {user.isActive ? (
            <button type="button" className="btn-danger" onClick={() => deactivateMutation.mutate()} disabled={deactivateMutation.isPending}>
              Deactivate
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => reactivateMutation.mutate()} disabled={reactivateMutation.isPending}>
              Reactivate
            </button>
          )}
        </div>
        {error && <div className="error-message admin-inline-error">{error}</div>}
      </td>
    </tr>
  );
}

export default function AdminConsolePage() {
  const queryClient = useQueryClient();
  const [workspaceFilter, setWorkspaceFilter] = useState('');
  const [usageFrom, setUsageFrom] = useState(utcDateDaysAgo(7));
  const [usageTo, setUsageTo] = useState(utcDateDaysAgo(0));
  const [usageWorkspaceFilter, setUsageWorkspaceFilter] = useState('');
  const [usageFilters, setUsageFilters] = useState({
    fromUtc: toUtcIso(utcDateDaysAgo(7)),
    toUtc: toUtcIso(utcDateDaysAgo(0)),
    workspaceId: null as number | null,
  });
  const [userUsageUserId, setUserUsageUserId] = useState('');
  const [userUsageFrom, setUserUsageFrom] = useState(utcDateDaysAgo(7));
  const [userUsageTo, setUserUsageTo] = useState(utcDateDaysAgo(0));
  const [accountId, setAccountId] = useState('');
  const [accountReason, setAccountReason] = useState('');
  const [recordType, setRecordType] = useState('process');
  const [recordId, setRecordId] = useState('');
  const [recordReason, setRecordReason] = useState('');
  const [recordQueryJson, setRecordQueryJson] = useState('');
  const [historyFrom, setHistoryFrom] = useState(utcDateDaysAgo(7));
  const [historyTo, setHistoryTo] = useState(utcDateDaysAgo(0));
  const [historyActorUserId, setHistoryActorUserId] = useState('');
  const [historyFilters, setHistoryFilters] = useState({
    fromUtc: toUtcIso(utcDateDaysAgo(7)),
    toUtc: toUtcIso(utcDateDaysAgo(0)),
    actorUserId: '',
  });
  const [errorMessage, setErrorMessage] = useState('');

  const usersQuery = useQuery({
    queryKey: ['admin-users', workspaceFilter],
    queryFn: () => adminApi.getUsers(workspaceFilter ? Number(workspaceFilter) : null),
  });

  const usageSummaryQuery = useQuery({
    queryKey: ['admin-usage-summary', usageFilters],
    queryFn: () =>
      adminApi.getUsageSummary({
        fromUtc: usageFilters.fromUtc,
        toUtc: usageFilters.toUtc,
        workspaceId: usageFilters.workspaceId,
      }),
  });

  const aiTokensQuery = useQuery({
    queryKey: ['admin-ai-tokens', usageFilters],
    queryFn: () =>
      adminApi.getAiTokenUsage({
        fromUtc: usageFilters.fromUtc,
        toUtc: usageFilters.toUtc,
        workspaceId: usageFilters.workspaceId,
      }),
  });

  const userUsageQuery = useQuery({
    queryKey: ['admin-user-usage', userUsageUserId, userUsageFrom, userUsageTo],
    queryFn: () =>
      adminApi.getUserUsage({
        userId: userUsageUserId,
        fromUtc: toUtcIso(userUsageFrom),
        toUtc: toUtcIso(userUsageTo),
      }),
    enabled: false,
  });

  const recordHistoryQuery = useQuery({
    queryKey: ['admin-record-history', historyFilters],
    queryFn: () =>
      adminApi.getRecordAccessHistory({
        fromUtc: historyFilters.fromUtc,
        toUtc: historyFilters.toUtc,
        actorUserId: historyFilters.actorUserId || undefined,
      }),
  });

  const accountIdValue = Number(accountId);
  const accountIdValid = accountId.trim().length > 0 && Number.isFinite(accountIdValue) && accountIdValue > 0;

  const deactivateAccountMutation = useMutation({
    mutationFn: () => adminApi.deactivateAccount(accountIdValue, { reason: accountReason || undefined }),
    onSuccess: () => {
      setErrorMessage('');
      setAccountReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (mutationError) => setErrorMessage(getApiMessage(mutationError, 'Failed to deactivate account.')),
  });

  const reactivateAccountMutation = useMutation({
    mutationFn: () => adminApi.reactivateAccount(accountIdValue, { reason: accountReason || undefined }),
    onSuccess: () => {
      setErrorMessage('');
      setAccountReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (mutationError) => setErrorMessage(getApiMessage(mutationError, 'Failed to reactivate account.')),
  });

  const recordQueryMutation = useMutation({
    mutationFn: () =>
      adminApi.queryRecordAccess({
        recordType,
        recordId,
        reason: recordReason,
      }),
    onSuccess: (response) => {
      setErrorMessage('');
      setRecordQueryJson(formatJson(response.data));
    },
    onError: (mutationError) => setErrorMessage(getApiMessage(mutationError, 'Failed to query record access.')),
  });

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-usage-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-ai-tokens'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-record-history'] }),
    ]);
  };

  const users = usersQuery.data ?? [];
  const usageSummary = usageSummaryQuery.data?.data;
  const aiTokens = aiTokensQuery.data?.data ?? [];
  const userUsage = userUsageQuery.data?.data;
  const historyRows = recordHistoryQuery.data?.data ?? [];

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>Admin Console</h1>
          <p className="admin-muted">Phase 1 controls for users, usage, account lifecycle, and record access.</p>
        </div>
        <button type="button" className="btn-primary" onClick={refreshAll}>
          Refresh all
        </button>
      </div>

      {errorMessage && <div className="error-message">{errorMessage}</div>}

      <section className="admin-section">
        <div className="admin-section-header">
          <div>
            <h2>Users</h2>
            <p className="admin-muted">Filter by workspace, then update a user inline.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={() => usersQuery.refetch()}>
            Reload users
          </button>
        </div>

        <div className="admin-filter-grid">
          <label>
            Workspace ID
            <input type="text" value={workspaceFilter} onChange={(event) => setWorkspaceFilter(event.target.value)} placeholder="Optional" />
          </label>
        </div>

        {usersQuery.isLoading ? (
          <div className="admin-empty-state">Loading users...</div>
        ) : usersQuery.error ? (
          <div className="error-message">Unable to load users.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Workspace</th>
                  <th>Account</th>
                  <th>Status</th>
                  <th>Role</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="admin-empty-state">No users returned.</div>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => <AdminUserRow key={user.userId} user={user} onRefresh={() => usersQuery.refetch()} />)
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-section">
        <div className="admin-section-header">
          <div>
            <h2>Usage</h2>
            <p className="admin-muted">Review aggregate usage and AI tokens for a date range.</p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              setUsageFilters({
                fromUtc: toUtcIso(usageFrom),
                toUtc: toUtcIso(usageTo),
                workspaceId: usageWorkspaceFilter ? Number(usageWorkspaceFilter) : null,
              })
            }
          >
            Refresh report
          </button>
        </div>

        <div className="admin-filter-grid">
          <label>
            From
            <input type="date" value={usageFrom} onChange={(event) => setUsageFrom(event.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={usageTo} onChange={(event) => setUsageTo(event.target.value)} />
          </label>
          <label>
            Workspace ID
            <input type="text" value={usageWorkspaceFilter} onChange={(event) => setUsageWorkspaceFilter(event.target.value)} placeholder="Optional" />
          </label>
        </div>

        {usageSummaryQuery.isLoading ? (
          <div className="admin-empty-state">Loading usage summary...</div>
        ) : usageSummary ? (
          <div className="admin-metrics-grid">
            <div className="admin-metric-card"><span>Users in scope</span><strong>{usageSummary.usersInScope}</strong></div>
            <div className="admin-metric-card"><span>Processes</span><strong>{usageSummary.processesCreated}</strong></div>
            <div className="admin-metric-card"><span>Diagnostics</span><strong>{usageSummary.diagnosticsCreated}</strong></div>
            <div className="admin-metric-card"><span>Responses saved</span><strong>{usageSummary.diagnosticResponsesSaved}</strong></div>
            <div className="admin-metric-card"><span>AI requests</span><strong>{usageSummary.aiRequestCount}</strong></div>
            <div className="admin-metric-card"><span>AI tokens</span><strong>{usageSummary.aiTotalTokenCount}</strong></div>
          </div>
        ) : null}

        <div className="admin-subsection">
          <h3>AI token breakdown</h3>
          {aiTokensQuery.isLoading ? (
            <div className="admin-empty-state">Loading AI token report...</div>
          ) : aiTokens.length === 0 ? (
            <div className="admin-empty-state">No AI token activity in this window.</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Model</th>
                  <th>Requests</th>
                  <th>Input</th>
                  <th>Output</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {aiTokens.map((row: AdminAiTokenUsageRow) => (
                  <tr key={`${row.provider}-${row.model}`}>
                    <td>{row.provider}</td>
                    <td>{row.model}</td>
                    <td>{row.requestCount}</td>
                    <td>{row.inputTokenCount}</td>
                    <td>{row.outputTokenCount}</td>
                    <td>{row.totalTokenCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="admin-subsection">
          <h3>User usage lookup</h3>
          <div className="admin-filter-grid">
            <label>
              User ID
              <input type="text" value={userUsageUserId} onChange={(event) => setUserUsageUserId(event.target.value)} />
            </label>
            <label>
              From
              <input type="date" value={userUsageFrom} onChange={(event) => setUserUsageFrom(event.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={userUsageTo} onChange={(event) => setUserUsageTo(event.target.value)} />
            </label>
            <button type="button" className="btn-primary admin-filter-button" onClick={() => userUsageQuery.refetch()} disabled={!userUsageUserId}>
              Load usage
            </button>
          </div>
          {userUsage && (
            <div className="admin-response-meta">
              <div>
                <strong>Requests</strong>
                <span>{userUsage.aiRequestCount}</span>
              </div>
              <div>
                <strong>AI tokens</strong>
                <span>{userUsage.aiTotalTokenCount}</span>
              </div>
              <div>
                <strong>Process events</strong>
                <span>{userUsage.processesCreated}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section-header">
          <div>
            <h2>Account lifecycle</h2>
            <p className="admin-muted">Deactivate or reactivate an account by ID.</p>
          </div>
        </div>

        <div className="admin-filter-grid">
          <label>
            Account ID
            <input type="text" value={accountId} onChange={(event) => setAccountId(event.target.value)} />
          </label>
          <label>
            Reason
            <input type="text" value={accountReason} onChange={(event) => setAccountReason(event.target.value)} />
          </label>
          <div className="admin-table-actions admin-account-actions">
            <button type="button" className="btn-danger" onClick={() => deactivateAccountMutation.mutate()} disabled={!accountIdValid || deactivateAccountMutation.isPending}>
              Deactivate account
            </button>
            <button type="button" className="btn-primary" onClick={() => reactivateAccountMutation.mutate()} disabled={!accountIdValid || reactivateAccountMutation.isPending}>
              Reactivate account
            </button>
          </div>
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section-header">
          <div>
            <h2>Record access</h2>
            <p className="admin-muted">Run a read-only query with a reason and review the access history.</p>
          </div>
        </div>

        <div className="admin-filter-grid">
          <label>
            Record type
            <input type="text" value={recordType} onChange={(event) => setRecordType(event.target.value)} />
          </label>
          <label>
            Record ID
            <input type="text" value={recordId} onChange={(event) => setRecordId(event.target.value)} />
          </label>
          <label>
            Reason
            <input type="text" value={recordReason} onChange={(event) => setRecordReason(event.target.value)} />
          </label>
          <button type="button" className="btn-primary admin-filter-button" onClick={() => recordQueryMutation.mutate()} disabled={!recordType || !recordId || !recordReason || recordQueryMutation.isPending}>
            Query record
          </button>
        </div>

        {recordQueryJson && (
          <div className="admin-subsection">
            <h3>Latest query result</h3>
            <pre className="admin-json">{recordQueryJson}</pre>
          </div>
        )}

        <div className="admin-subsection">
          <div className="admin-section-header">
            <h3>History</h3>
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                setHistoryFilters({
                  fromUtc: toUtcIso(historyFrom),
                  toUtc: toUtcIso(historyTo),
                  actorUserId: historyActorUserId,
                })
              }
            >
              Refresh history
            </button>
          </div>

          <div className="admin-filter-grid">
            <label>
              From
              <input type="date" value={historyFrom} onChange={(event) => setHistoryFrom(event.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={historyTo} onChange={(event) => setHistoryTo(event.target.value)} />
            </label>
            <label>
              Actor user ID
              <input type="text" value={historyActorUserId} onChange={(event) => setHistoryActorUserId(event.target.value)} placeholder="Optional" />
            </label>
          </div>

          {recordHistoryQuery.isLoading ? (
            <div className="admin-empty-state">Loading history...</div>
          ) : historyRows.length === 0 ? (
            <div className="admin-empty-state">No record-access history in this window.</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Record</th>
                  <th>Reason</th>
                  <th>Results</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row: AdminRecordAccessHistoryRow) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.createdAt)}</td>
                    <td>{row.actorUserId}</td>
                    <td>{row.recordType} / {row.recordId}</td>
                    <td>{row.reason}</td>
                    <td>{row.resultCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
