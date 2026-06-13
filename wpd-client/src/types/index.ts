export interface User {
  userId: string;
  email: string;
  displayName: string;
  subscriptionTierId: number;
  subscriptionTierName: string;
  defaultWorkspaceId?: number;
}

export interface AuthResponse {
  userId: string;
  email: string;
  displayName: string;
  token: string;
  subscriptionTierId: number;
  subscriptionTierName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface Process {
  id: number;
  workspaceId: number;
  name: string;
  description: string;
  problemStatement: string;
  context: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProcessRequest {
  name: string;
  description: string;
  problemStatement: string;
  context: string;
}

export interface TierLimitError {
  error: string;
  message: string;
  currentTier: string;
  currentProcessCount: number;
  maxAllowedProcesses: number;
  upgradePrompt: string;
}

export interface PublicLens {
  id: number;
  name: string;
  code: string;
  displayOrder: number;
  publicDescription: string;
}

export interface LandingContent {
  title: string;
  subtitle: string;
  highlights: string[];
  distressSignals: string[];
  callToActionText: string;
  callToActionRoute: string;
}
