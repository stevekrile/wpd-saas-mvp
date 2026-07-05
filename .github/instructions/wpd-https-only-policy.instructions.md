---
description: "HTTPS-only security policy for WPD. All connections must use HTTPS, never HTTP. Covers backend, frontend, API calls, and documentation."
applyTo: "**/*"
---

# WPD HTTPS-Only Policy

## Mandate

**All connections in the WPD product must be HTTPS. HTTP is strictly prohibited in all environments: development, staging, and production.**

This includes:
- Backend API endpoints
- Frontend-to-backend API calls
- Inter-service communication
- Documentation and references
- Configuration files
- Startup scripts and commands

## Why HTTPS-Only

1. **Security:** Encrypts all data in transit, protecting user credentials, process data, and system information
2. **Compliance:** Meets modern security standards and requirements for production deployments
3. **Privacy:** Ensures diagnostic data and organizational information remain confidential
4. **Trust:** Demonstrates commitment to data protection for users and organizations
5. **Consistency:** Single security model eliminates protocol-switching complexity

## Backend Configuration

### Development Environment

The backend API **must** be started with the HTTPS profile:

```bash
cd C:\Users\skril\source\repos\WPD\Wpd.api
dotnet run --launch-profile https
```

**Listening URLs:**
- `https://localhost:7193` (primary)
- `http://localhost:5123` (fallback, for IIS express compatibility only—do not use for direct connections)

### Launch Settings

File: `Wpd.Api\Properties\launchSettings.json`

The `https` profile is the **default and required profile**. The `http` profile exists only for backwards compatibility with IIS Express and **must not be used**.

Only the `https` profile should have `dotnetRunMessages: true` and `launchBrowser: true`.

### Server Configuration (Kestrel)

The `Program.cs` must enforce HTTPS:
- Use `.UseHttpsRedirection()` to redirect any HTTP traffic to HTTPS
- Configure Kestrel to listen only on HTTPS ports in production
- In development, use self-signed certificates (configured in launchSettings.json)

### API Endpoints

All API endpoints are served over HTTPS:
- Swagger UI: `https://localhost:7193/swagger` (development)
- Swagger JSON: `https://localhost:7193/swagger/v1/swagger.json`
- API base: `https://localhost:7193/api/` (development)
- Production API: `https://api.wpd.example.com/` (adjust domain as needed)

## Frontend Configuration

### Development Environment

The frontend dev server **should** use HTTPS:

```bash
cd C:\Users\skril\source\repos\WPD\wpd-client
npm run dev
```

The WPD Vite config already enforces HTTPS for local development; do not pass `--https` directly to Vite.

Or update `vite.config.ts` to default to HTTPS:

```typescript
export default defineConfig({
  server: {
    https: true,
  },
  plugins: [react()],
})
```

**Listening URL:**
- `https://localhost:5173` (or next available port if in use)

### API Client Configuration

File: `wpd-client\src\api\`

All API client methods must:
1. Use the HTTPS protocol in base URLs
2. Include the correct port for environment (7193 for dev HTTPS)
3. Never construct HTTP URLs
4. Validate certificate in non-development environments

Example:

```typescript
const getApiBaseUrl = () => {
  if (import.meta.env.DEV) {
    return 'https://localhost:7193';
  }
  return import.meta.env.VITE_API_URL || 'https://api.wpd.example.com';
};

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  https: true,
});
```

### Environment Variables

File: `wpd-client\.env` (and variants)

```env
# Development
VITE_API_URL=https://localhost:7193

# Staging
# VITE_API_URL=https://staging-api.wpd.example.com

# Production
# VITE_API_URL=https://api.wpd.example.com
```

**Never use HTTP URLs in environment variables.**

## Docker & Containerization

When deploying in Docker:
- Ensure the backend is configured to listen on HTTPS only
- Use valid SSL/TLS certificates (not self-signed) in production
- Configure reverse proxies (nginx, Traefik) to terminate HTTPS connections
- Pass only HTTPS health check URLs

Example Dockerfile snippet:

```dockerfile
EXPOSE 7193
ENV ASPNETCORE_URLS=https://+:7193
ENV ASPNETCORE_Kestrel__Certificates__Default__Path=/app/certs/server.pfx
ENV ASPNETCORE_Kestrel__Certificates__Default__Password=${CERT_PASSWORD}
```

## Testing & Validation

### Swagger (API Documentation)

Access via:
- Development: `https://localhost:7193/swagger`
- Never use HTTP to access Swagger

### Browser Console

When testing the frontend in development:
- Browser DevTools → Network tab: verify all requests show `https://` protocol
- Check for mixed content warnings (if any HTTP is accidentally used)

### API Testing Tools

When using Postman, cURL, or similar:

```bash
# CORRECT (HTTPS)
curl https://localhost:7193/api/processes

# INCORRECT (will be rejected)
curl http://localhost:7193/api/processes
```

For self-signed certificates in development:

```bash
curl -k https://localhost:7193/api/processes
```

## Documentation & References

All documentation files must reference HTTPS URLs:

- **Development API:** `https://localhost:7193`
- **Development Frontend:** `https://localhost:5173`
- **Swagger URL:** `https://localhost:7193/swagger`
- **API base path:** `https://localhost:7193/api/`

Update any existing documentation that references HTTP to use HTTPS.

### Common Files to Update

- `README.md` (project root)
- All `.instructions.md` files
- API client comments and docstrings
- Architecture diagrams and runbooks
- CI/CD deployment scripts

## Exceptions & Waivers

**There are no exceptions to the HTTPS-only policy.**

If a specific scenario requires HTTP:
1. Document the business requirement
2. File an issue explaining why
3. Escalate for security review
4. Implement a temporary waiver **only after approval**

Even temporary HTTP connections must be:
- Documented with expiration date
- Logged/audited
- Monitored for removal

## Implementation Checklist

- [ ] Backend launches with `--launch-profile https` by default
- [ ] Frontend dev server configured for HTTPS
- [ ] All API client base URLs use `https://`
- [ ] Environment variables only reference HTTPS
- [ ] Documentation updated to reference HTTPS URLs only
- [ ] Swagger accessible only via HTTPS
- [ ] Certificate validation enabled in production code
- [ ] CI/CD pipelines deploy with HTTPS enforced
- [ ] Health checks use HTTPS endpoints
- [ ] Monitoring and logging reference HTTPS URLs

## Related Configuration Files

- `Wpd.Api\Properties\launchSettings.json` — backend profiles
- `wpd-client\vite.config.ts` — frontend dev server
- `wpd-client\.env` and variants — environment URLs
- `wpd-client\src\api\*.ts` — API client configuration
- `Wpd.Api\Program.cs` — server middleware configuration

## Questions?

If you're unsure whether a specific connection should be HTTPS, assume **yes, it must be HTTPS**. When in doubt, escalate to the security/architecture team.
