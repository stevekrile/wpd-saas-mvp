---
name: spin-up
description: "Start or confirm both WPD development servers. Use when the user says spin up, start dev servers, launch frontend and backend, boot the app, or confirm both local servers are running."
argument-hint: "Optional: confirm-only"
---

# Spin Up

Use this skill to start or confirm both WPD development servers:
- Backend: `Wpd.Api` on `https://localhost:7193`
- Frontend: `wpd-client` Vite dev server on `https://localhost:5173` (or the next available HTTPS port)

## Procedure
1. Check whether the backend and frontend are already running.
   - Prefer existing detached PowerShell sessions if they were started by the agent.
   - Also verify expected ports and URLs.
2. If the backend is not running, start it from `C:\Users\skril\source\repos\WPD\Wpd.Api` with:
   - `dotnet run --launch-profile https`
3. If the frontend is not running, start it from `C:\Users\skril\source\repos\WPD\wpd-client` with:
   - `npm run dev`
4. Start long-lived servers with detached async PowerShell sessions so they remain available.
5. Confirm each server is responsive.
   - Backend: verify `https://localhost:7193/swagger` or the API root responds.
   - Frontend: verify the Vite HTTPS URL responds, using the actual port reported by Vite if 5173 was unavailable.
6. Report the backend URL, frontend URL, and whether each server was reused or newly started.

## Guardrails
- Always use HTTPS URLs.
- Backend must use the `https` launch profile.
- Do not start duplicate servers if healthy ones are already running.
- If one server fails to start, report which one failed and include the relevant output.
