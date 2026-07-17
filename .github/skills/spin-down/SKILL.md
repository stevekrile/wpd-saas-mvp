---
name: spin-down
description: "Stop and confirm both WPD development servers are closed. Use when the user says spin down, stop dev servers, shut down frontend and backend, or close local app servers."
argument-hint: "Optional: backend-only or frontend-only"
---

# Spin Down

Use this skill to stop both WPD development servers and confirm they are no longer reachable.

## Targets
- Backend dev server for `Wpd.Api` (`https://localhost:7193`)
- Frontend dev server for `wpd-client` (`https://localhost:5173` or the active Vite HTTPS port)

## Procedure
1. Check for detached or active PowerShell sessions that were used to start the backend or frontend.
2. If matching sessions exist, stop them with the session-aware stop tool.
3. If no tracked session exists, identify the exact owning process IDs from the expected ports or commands.
4. Stop only the specific backend/frontend process IDs. Use `Stop-Process -Id <PID>` for direct process shutdown.
5. Confirm both servers are down.
   - Backend URL should no longer respond on `https://localhost:7193`.
   - Frontend Vite URL should no longer respond on its active HTTPS port.
6. Report what was stopped and whether anything was already down.

## Guardrails
- Never kill by process name alone.
- Do not stop unrelated `dotnet` or `node` processes outside this workspace.
- If a server cannot be matched confidently to this repo, stop and explain instead of guessing.
