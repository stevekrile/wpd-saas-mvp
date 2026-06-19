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
npm run dev -- --https
```

Frontend typically runs on **`https://localhost:5173`** (or next available port if in use).

**⚠️ IMPORTANT:** Always use HTTPS. See [HTTPS-Only Policy](./wpd-https-only-policy.instructions.md) for details.

## Architecture

- **Backend:** .NET 8 API (Wpd.Api)
- **Frontend:** React + TypeScript (wpd-client)
- **Database:** SQL Server (Entity Framework Core)

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
