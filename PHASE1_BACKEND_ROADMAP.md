# WPD Phase 1 Backend Roadmap - AI + Administration

## Purpose

This document combines the Phase 1 backend plans for:
- AI recommendation generation from completed four-lens evaluations
- Administration capabilities (users, usage, record access, activation/deactivation)

Goal: deliver a production-ready, auditable backend foundation for generative recommendations with governance controls.

## Phase 1 Outcomes

By the end of Phase 1, WPD will support:
1. Structured AI recommendations for completed diagnostics
2. Immutable request/response history for auditability
3. Token usage capture and reporting by user/account/time range
4. Admin controls for user/account lifecycle (activate/deactivate)
5. Role-gated administrative access to usage and support records

## Architecture Boundaries

### AI Domain (separate bounded logic)
- `AiRecommendationsController`
- `IAiRecommendationService`
- `IAiProviderClient`
- AI persistence entities (`AiRecommendation`, `AiRecommendationFeedback`)

### Administration Domain (separate bounded logic)
- `AdminUsersController`
- `AdminUsageController`
- `AdminRecordAccessController`
- Admin services (`IAdminUserService`, `IAdminUsageService`, `IAdminRecordAccessService`, `IAdminAuditService`)
- Admin entities (`UserAdminState`, `AccountAdminState`, `AdminAuditEvent`, `AdminRecordAccessEvent`)

### Shared Platform Concerns
- JWT/Clerk auth
- Role + scope authorization policies
- HTTPS-only access
- Correlation IDs and observability
- SQL Server persistence

## API Surface (Phase 1)

## AI Endpoints
- `POST /api/ai/recommendations`
- `GET /api/ai/recommendations/{id}`
- `POST /api/ai/recommendations/{id}/feedback`
- `GET /api/ai/audit/token-usage` (admin/service scoped)

## Admin Endpoints
- `GET /api/admin/users?workspaceId={id}`
- `GET /api/admin/users/{userId}`
- `PATCH /api/admin/users/{userId}/role`
- `POST /api/admin/users/{userId}/deactivate`
- `POST /api/admin/users/{userId}/reactivate`
- `POST /api/admin/accounts/{accountId}/deactivate`
- `POST /api/admin/accounts/{accountId}/reactivate`
- `GET /api/admin/usage/summary?fromUtc=&toUtc=&workspaceId=`
- `GET /api/admin/usage/users/{userId}?fromUtc=&toUtc=`
- `GET /api/admin/usage/ai-tokens?fromUtc=&toUtc=&workspaceId=`
- `POST /api/admin/record-access/query`
- `GET /api/admin/record-access/history?fromUtc=&toUtc=&actorUserId=`

## Data and Audit Strategy

### AI Recommendation Persistence (immutable)
Each generation call creates a new `AiRecommendation` record with:
- Input/output snapshots
- Prompt/model metadata
- Provider request id
- `DiagnosticSnapshotHash`
- Token fields (`InputTokenCount`, `OutputTokenCount`, `TotalTokenCount`, `TokenUsageIsEstimated`)
- Status/failure details
- Timestamp and ownership scope

No prior recommendation row is overwritten.

### Administrative Audit Persistence
All sensitive admin actions create `AdminAuditEvent` entries with:
- actor, action, target, reason, scope, metadata, timestamp

Record lookups also create `AdminRecordAccessEvent` entries (read-only support actions with reason capture).

## Security Model

- HTTPS-only for all endpoints and provider calls
- `[Authorize]` on all AI/admin endpoints
- Role policy enforcement:
  - `User`: normal product actions only
  - `Admin`: account/workspace-scoped admin operations
  - `SystemAdmin`: platform-wide elevated operations
- Scope enforcement on every admin and audit query
- Deactivated user/account state blocks normal API actions

## AI Response Contract (Canonical)

```json
{
  "startingLens": "business|information|human|organizational",
  "whyNow": "string",
  "expectedImpact": "string",
  "firstThreeActions": ["string", "string", "string"],
  "kpiCandidates": ["string"],
  "confidence": 0.0,
  "openQuestions": ["string"]
}
```

Validation rules:
- `firstThreeActions` exactly 3 items
- `confidence` range `0.0-1.0`
- `startingLens` constrained to supported keys

Invalid model output returns controlled errors (no free-form fallback response).

## Error Model

Standard categories across domains:
- `400` validation error
- `403` role/scope forbidden
- `404` target not found in scope
- `409` invalid state transition (e.g., activation state) or incomplete diagnostic
- `422` AI response schema invalid
- `502` provider timeout/unavailable

Responses include stable error codes and correlation IDs.

## Observability and Reporting

Track:
- request/correlation IDs
- endpoint latency and provider latency
- AI token usage (measured vs estimated)
- success/failure counts by endpoint/error code
- model/template versions
- usage attribution by user/workspace/account

Rollups:
- per user
- per workspace/account
- per model/provider
- per time window

## Delivery Sequence (Integrated)

1. Define role policies and claims mapping (`User`, `Admin`, `SystemAdmin`).
2. Add AI + admin entities and migrations (including token and audit fields).
3. Implement `IAdminAuditService` and enforce audit writes on admin mutations/record-access.
4. Implement AI provider abstraction and recommendation service with strict schema validation.
5. Implement AI recommendation endpoints and immutable persistence.
6. Implement admin user/account activation/deactivation flows and authorization checks.
7. Implement usage reporting endpoints (including AI token rollups).
8. Implement read-only record-access query endpoint with reason capture.
9. Add Swagger documentation, endpoint auth annotations, and error code catalog.

## MVP Acceptance Criteria

- Completed diagnostic can generate a structured recommendation.
- Each generation is persisted as a new immutable record (history retained).
- Token usage is stored per recommendation with measured/estimated flag.
- Admin can audit usage by user/account/date range.
- Admin can activate/deactivate users and accounts.
- Deactivated users/accounts are blocked from normal API operations.
- Record-access support queries are role-gated, reason-captured, and audited.
- All admin actions are captured in immutable audit logs.

## Phase 2 Readiness

This combined Phase 1 creates deterministic and auditable inputs for agentic workflows:
- AI outputs (`startingLens`, `firstThreeActions`, `kpiCandidates`, `openQuestions`)
- Governance controls (roles, lifecycle, record access)
- Usage telemetry for cost and capacity planning
