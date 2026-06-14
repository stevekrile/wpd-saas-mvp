# WPD Project Development Guide

## Backend API Configuration

**Backend API Port:** 7193

The WPD API runs on `http://localhost:7193` in development.

### Starting the Backend

```bash
cd C:\Users\skril\source\repos\WPD\Wpd.api
dotnet run
```

The server listens on `http://localhost:7193` by default.

### Starting the Frontend

```bash
cd C:\Users\skril\source\repos\WPD\wpd-client
npm run dev
```

Frontend typically runs on `http://localhost:5174` (or next available port if 5173+ are in use).

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
