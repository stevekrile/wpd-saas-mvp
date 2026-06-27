import apiClient from './apiClient';

export interface AdminUserSummary {
  userId: string;
  email: string;
  displayName: string;
  workspaceId: number | null;
  accountId: number | null;
  isActive: boolean;
  role: string;
}

export interface AdminUserDetail extends AdminUserSummary {
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminUsageSummary {
  fromUtc: string;
  toUtc: string;
  workspaceId: number | null;
  accountId: number | null;
  usersInScope: number;
  processesCreated: number;
  diagnosticsCreated: number;
  diagnosticResponsesSaved: number;
  upgradeEvents: number;
  aiRequestCount: number;
  aiInputTokenCount: number;
  aiOutputTokenCount: number;
  aiTotalTokenCount: number;
}

export interface AdminUserUsage {
  userId: string;
  fromUtc: string;
  toUtc: string;
  processesCreated: number;
  diagnosticsCreated: number;
  diagnosticResponsesSaved: number;
  upgradeEvents: number;
  aiRequestCount: number;
  aiInputTokenCount: number;
  aiOutputTokenCount: number;
  aiTotalTokenCount: number;
}

export interface AdminAiTokenUsageRow {
  provider: string;
  model: string;
  requestCount: number;
  inputTokenCount: number;
  outputTokenCount: number;
  totalTokenCount: number;
  estimatedUsageCount: number;
}

export interface AdminRecordAccessResult {
  recordType: string;
  recordId: string;
  resultCount: number;
  data: Record<string, unknown>;
}

export interface AdminRecordAccessHistoryRow {
  id: number;
  actorUserId: string;
  recordType: string;
  recordId: string;
  reason: string;
  resultCount: number;
  createdAt: string;
}

export interface AdminActionRequest {
  reason?: string;
}

export interface UpdateUserRoleRequest {
  role: string;
  reason?: string;
}

export interface AdminQueryResponse<T> {
  requestId: string;
  performedBy: string;
  performedAtUtc: string;
  data: T;
}

export interface AdminMutationResponse {
  requestId: string;
  performedBy: string;
  performedAtUtc: string;
  targetId: string;
}

export interface AdminErrorResponse {
  requestId: string;
  errorCode: string;
  message: string;
}

export interface AdminRecordAccessRequest {
  recordType: string;
  recordId: string;
  reason: string;
}

const unwrapQueryResponse = <T,>(response: { data: AdminQueryResponse<T> }) => response.data.data;

const unwrapMutationResponse = (response: { data: AdminMutationResponse }) => response.data;

export const adminApi = {
  getUsers: async (workspaceId?: number | null): Promise<AdminUserSummary[]> => {
    const response = await apiClient.get<AdminUserSummary[]>('/api/admin/users', {
      params: workspaceId ? { workspaceId } : undefined,
    });
    return response.data;
  },

  getUser: async (userId: string): Promise<AdminUserDetail> => {
    const response = await apiClient.get<AdminUserDetail>(`/api/admin/users/${encodeURIComponent(userId)}`);
    return response.data;
  },

  updateUserRole: async (userId: string, request: UpdateUserRoleRequest): Promise<AdminMutationResponse> => {
    const response = await apiClient.patch<AdminMutationResponse>(
      `/api/admin/users/${encodeURIComponent(userId)}/role`,
      request
    );
    return unwrapMutationResponse(response);
  },

  deactivateUser: async (userId: string, request: AdminActionRequest): Promise<AdminMutationResponse> => {
    const response = await apiClient.post<AdminMutationResponse>(
      `/api/admin/users/${encodeURIComponent(userId)}/deactivate`,
      request
    );
    return unwrapMutationResponse(response);
  },

  reactivateUser: async (userId: string, request: AdminActionRequest): Promise<AdminMutationResponse> => {
    const response = await apiClient.post<AdminMutationResponse>(
      `/api/admin/users/${encodeURIComponent(userId)}/reactivate`,
      request
    );
    return unwrapMutationResponse(response);
  },

  deactivateAccount: async (accountId: number, request: AdminActionRequest): Promise<AdminMutationResponse> => {
    const response = await apiClient.post<AdminMutationResponse>(`/api/admin/accounts/${accountId}/deactivate`, request);
    return unwrapMutationResponse(response);
  },

  reactivateAccount: async (accountId: number, request: AdminActionRequest): Promise<AdminMutationResponse> => {
    const response = await apiClient.post<AdminMutationResponse>(`/api/admin/accounts/${accountId}/reactivate`, request);
    return unwrapMutationResponse(response);
  },

  getUsageSummary: async (filters: {
    fromUtc: string;
    toUtc: string;
    workspaceId?: number | null;
  }): Promise<AdminQueryResponse<AdminUsageSummary>> => {
    const response = await apiClient.get<AdminQueryResponse<AdminUsageSummary>>('/api/admin/usage/summary', {
      params: {
        fromUtc: filters.fromUtc,
        toUtc: filters.toUtc,
        ...(filters.workspaceId ? { workspaceId: filters.workspaceId } : {}),
      },
    });
    return response.data;
  },

  getUserUsage: async (filters: {
    userId: string;
    fromUtc: string;
    toUtc: string;
  }): Promise<AdminQueryResponse<AdminUserUsage>> => {
    const response = await apiClient.get<AdminQueryResponse<AdminUserUsage>>(
      `/api/admin/usage/users/${encodeURIComponent(filters.userId)}`,
      {
        params: {
          fromUtc: filters.fromUtc,
          toUtc: filters.toUtc,
        },
      }
    );
    return response.data;
  },

  getAiTokenUsage: async (filters: {
    fromUtc: string;
    toUtc: string;
    workspaceId?: number | null;
  }): Promise<AdminQueryResponse<AdminAiTokenUsageRow[]>> => {
    const response = await apiClient.get<AdminQueryResponse<AdminAiTokenUsageRow[]>>('/api/admin/usage/ai-tokens', {
      params: {
        fromUtc: filters.fromUtc,
        toUtc: filters.toUtc,
        ...(filters.workspaceId ? { workspaceId: filters.workspaceId } : {}),
      },
    });
    return response.data;
  },

  queryRecordAccess: async (request: AdminRecordAccessRequest): Promise<AdminQueryResponse<AdminRecordAccessResult>> => {
    const response = await apiClient.post<AdminQueryResponse<AdminRecordAccessResult>>('/api/admin/record-access/query', request);
    return response.data;
  },

  getRecordAccessHistory: async (filters: {
    fromUtc: string;
    toUtc: string;
    actorUserId?: string;
  }): Promise<AdminQueryResponse<AdminRecordAccessHistoryRow[]>> => {
    const response = await apiClient.get<AdminQueryResponse<AdminRecordAccessHistoryRow[]>>('/api/admin/record-access/history', {
      params: {
        fromUtc: filters.fromUtc,
        toUtc: filters.toUtc,
        ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
      },
    });
    return response.data;
  },

  unwrapQueryResponse,
};

