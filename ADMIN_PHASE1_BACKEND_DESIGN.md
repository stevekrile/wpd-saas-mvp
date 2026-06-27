# WPD Administration Phase 1 - Backend Design Plan

## Objective

Define a minimal but durable administration capability for Phase 1 that supports:
- User administration
- Usage auditing
- Record access controls
- Account activation and deactivation

This plan is designed to work with the existing WPD API and the Phase 1 AI backend design without tightly coupling admin logic to AI orchestration.

## Design Principles

- Keep administration as a separate backend capability (bounded logic), not embedded inside AI services.
- Reuse current authentication (JWT/Clerk) and enforce role-based authorization in API endpoints.
- Make all administrative actions auditable.
- Use immutable audit history for sensitive actions.
- Enforce HTTPS-only access for all admin endpoints.

## Scope (Phase 1)

In scope:
- Admin role model and authorization gates
- User listing and status management
- Account activation/deactivation
- Usage reporting (including AI token usage)
- Controlled record access tooling for support and audit
- Admin action audit logs

Out of scope:
- Full organization provisioning workflows
- Fine-grained policy builder UI
- Automated lifecycle workflows (scheduled suspension/reactivation)

## Roles and Authorization

### Roles

- `User`: standard product user; no admin endpoints.
- `Admin`: workspace/account admin; can manage users and view account-scoped usage.
- `SystemAdmin`: platform-level admin; can view cross-account usage and perform escalated support actions.

### Authorization Requirements

- All admin endpoints require authenticated identity.
- Endpoints must validate both role and scope (workspace/account ownership).
- `SystemAdmin` operations should be explicitly separated from `Admin` operations.

## Core Capabilities

## 1) User Administration

Capabilities:
- List users by account/workspace
- View user profile/status/role metadata
- Update allowed administrative fields (role assignment within policy)

MVP API surface:
- `GET /api/admin/users?workspaceId={id}`
- `GET /api/admin/users/{userId}`
- `PATCH /api/admin/users/{userId}/role`

## 2) Usage Auditing

Capabilities:
- Usage rollups by user/account/time range
- AI usage metrics (request counts, token counts, model/provider usage)
- Export-ready response shape for admin reporting UI

MVP API surface:
- `GET /api/admin/usage/summary?fromUtc=&toUtc=&workspaceId=`
- `GET /api/admin/usage/users/{userId}?fromUtc=&toUtc=`
- `GET /api/admin/usage/ai-tokens?fromUtc=&toUtc=&workspaceId=`

## 3) Record Access (Support + Audit)

Capabilities:
- Read-only administrative retrieval of records for support and auditing
- Scoped retrieval by account/workspace unless `SystemAdmin`
- Explicit reason capture for sensitive lookups

MVP API surface:
- `POST /api/admin/record-access/query`
  - Body includes `recordType`, `recordId`, `reason`
- `GET /api/admin/record-access/history?fromUtc=&toUtc=&actorUserId=`

Constraints:
- Phase 1 is read-only for record access operations.
- No admin edit of business records through support endpoints in Phase 1.

## 4) Account Activation / Deactivation

Capabilities:
- Deactivate account/user access quickly and safely
- Reactivate with full audit trail
- Enforce deactivation checks in core API authorization path

MVP API surface:
- `POST /api/admin/users/{userId}/deactivate`
- `POST /api/admin/users/{userId}/reactivate`
- `POST /api/admin/accounts/{accountId}/deactivate`
- `POST /api/admin/accounts/{accountId}/reactivate`

Behavior:
- Deactivation blocks new authenticated API actions for target user/account.
- Historical records remain intact and queryable by authorized admins.

## Data Model (Phase 1)

### Admin Metadata

- `UserAdminState`
  - `UserId`
  - `AccountId` / `WorkspaceId`
  - `IsActive`
  - `DeactivatedAt` (nullable)
  - `DeactivatedByUserId` (nullable)
  - `DeactivationReason` (nullable)
  - `ReactivatedAt` (nullable)
  - `ReactivatedByUserId` (nullable)

- `AccountAdminState`
  - `AccountId`
  - `IsActive`
  - `DeactivatedAt` (nullable)
  - `DeactivatedByUserId` (nullable)
  - `DeactivationReason` (nullable)

### Audit Tables

- `AdminAuditEvent`
  - `Id`
  - `ActorUserId`
  - `ActorRole`
  - `ActionType` (e.g., `UserDeactivated`, `RecordAccessed`, `RoleChanged`)
  - `TargetType` (`User`, `Account`, `Process`, `Diagnostic`, `AiRecommendation`)
  - `TargetId`
  - `WorkspaceId` / `AccountId`
  - `Reason` (nullable)
  - `MetadataJson`
  - `CreatedAt`

- `AdminRecordAccessEvent`
  - `Id`
  - `ActorUserId`
  - `RecordType`
  - `RecordId`
  - `Reason`
  - `ResultCount`
  - `CreatedAt`

## Service Architecture

Add dedicated application services:
- `IAdminUserService`
- `IAdminUsageService`
- `IAdminRecordAccessService`
- `IAdminAuditService`

Admin controllers should orchestrate through these services and avoid direct data access logic in controllers.

## API and Response Contracts

All admin responses should include:
- `requestId` / correlation id
- `performedBy` (for mutation endpoints)
- `performedAtUtc`
- Stable error codes for UI handling

Mutation endpoints should return deterministic status:
- `200/204` on success
- `400` validation error
- `403` insufficient role/scope
- `404` target not found in scope
- `409` invalid state transition (already deactivated/reactivated)

## Security and Compliance

- HTTPS-only endpoints.
- Strict `[Authorize]` and role policy checks.
- Scope checks on every admin operation.
- Mandatory audit logging for all admin mutations and record-access reads.
- No sensitive secrets/tokens in logs.
- Reason required for sensitive record-access queries.

## Integration with AI Phase 1

Administration capability directly supports AI Phase 1 by providing:
- Account/user token usage audit endpoints
- Role-gated access to AI recommendation audit history
- Immutable audit trail for AI-related administrative reads

AI services remain separate and call shared admin/audit services only when needed for authorization and reporting.

## Delivery Plan (Phase 1)

1. Define admin role policies and claims mapping.
2. Add admin state entities and audit entities + migrations.
3. Implement `IAdminAuditService` first and wire into admin mutations.
4. Implement user activation/deactivation endpoints.
5. Implement usage summary endpoints (including AI token rollups).
6. Implement record-access query endpoint with reason capture and read-only guardrails.
7. Add Swagger docs and endpoint authorization annotations.

## MVP Acceptance Criteria

- Admin can list and manage user activation status within allowed scope.
- Deactivated users/accounts are blocked from normal API actions.
- Admin can retrieve usage summaries by user/account/date range.
- AI token usage is available in admin usage reports.
- Record-access queries are role-gated, reason-captured, and auditable.
- All admin actions are persisted in immutable audit logs.
