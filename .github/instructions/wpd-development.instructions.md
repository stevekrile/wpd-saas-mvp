# WPD Project Development Guide

## Backend API Configuration

**Backend API Port:** 7193

The WPD API runs on **`https://localhost:7193`** in development (HTTPS only).

### Starting the Backend

```bash
cd C:\Users\skril\source\repos\WPD\Wpd.api
dotnet run --launch-profile https
```

The server listens on **`https://localhost:7193`** by default.

**⚠️ IMPORTANT:** Always use the `https` launch profile. Never use the `http` profile. See [HTTPS-Only Policy](./wpd-https-only-policy.instructions.md) for details.

### Starting the Frontend

```bash
cd C:\Users\skril\source\repos\WPD\wpd-client
npm run dev
```

Frontend typically runs on **`https://localhost:5173`** (or next available port if in use).

**⚠️ IMPORTANT:** Always use HTTPS. See [HTTPS-Only Policy](./wpd-https-only-policy.instructions.md) for details.

## Architecture

- **Backend:** .NET 8 API (Wpd.Api)
- **Frontend:** React + TypeScript (wpd-client)
- **Database:** SQL Server (Entity Framework Core)

## Game Logic Separation

When working on portable game features such as Rogue Brick:

- Put game rules, board generation, combat math, scoring, rewards, and progression in pure TypeScript modules under `wpd-client\src\features\`.
- Keep page files such as `wpd-client\src\pages\app\RogueBrickPage.tsx` focused on web wiring: React state, browser input, canvas drawing, layout, and accessibility behavior.
- Do not couple portable game logic to React, DOM APIs, canvas APIs, timers owned by components, or browser-only globals unless that code is part of the web adapter layer.
- Prefer small platform-agnostic helpers with explicit inputs/outputs so the same logic can be reused by future iOS, Android, and Steam clients.

## Key Files for Common Tasks

### Diagnostic Persistence
- Backend: `Wpd.Api\Controllers\DiagnosticsController.cs` - API endpoints
- Backend: `Wpd.Application\Services\Processes\ProcessService.cs` - SaveDiagnosticResponseAsync validation logic
- Frontend: `wpd-client\src\api\processApi.ts` - API client methods
- Frontend: `wpd-client\src\pages\app\DiagnosticWizardPage.tsx` - UI state + persistence

### DTOs
- `Wpd.Api\DTOs\Diagnostics\DiagnosticDtos.cs` - Diagnostic response types

## Coding Preferences

- Use PowerShell for .NET file edits (more stable than edit tool for C# files)
- Keep edits atomic: one change per PowerShell call, build after each step
- New controller files avoid contention on shared files like ProcessesController.cs

## Testing

- Backend: `dotnet build` to verify no compilation errors
- Frontend: `npm run build` for production build verification
- Both: Run servers and manually test flow end-to-end

## LLM Harness Configuration (Process Diagnostic)

The Diagnostic Summary tab uses a BYOK (Bring Your Own Key) pattern:

- Users save provider keys via `Connected AI Accounts` in the app UI.
- Keys are encrypted server-side before storage.
- Keys are never stored in frontend `.env` files or local storage.

Server config under `LLM` in `Wpd.Api\appsettings*.json` is only for provider defaults such as `Model`, `BaseUrl`, and `MaxTokens`, not for shared API keys.
