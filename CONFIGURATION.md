# WPD Port & Configuration Guide

## Development Environment

### Frontend
- **URL:** http://localhost:5173 (Vite dev server)
- **Configuration:** `.env.development`
- **API Endpoint:** Reads from `VITE_API_URL` env var
- **Default:** `https://localhost:7193`

### Backend API
- **HTTPS URL:** https://localhost:7193 (primary)
- **HTTP URL:** http://localhost:5123 (fallback)
- **Profile:** `https` (from launchSettings.json)
- **Configuration:** `appsettings.json`
- **CORS:** Configured in `CORS:AllowedOrigins`

### Startup Commands

**Backend:**
```bash
cd C:\Users\skril\source\repos\WPD\Wpd.api
dotnet run --launch-profile https
```

**Frontend:**
```bash
cd C:\Users\skril\source\repos\WPD\wpd-client
npm run dev
```

---

## Configuration Management

### Backend Configuration Hierarchy

1. **appsettings.json** (default/development)
   - Local development database
   - CORS: `["http://localhost:5173"]`
   - Logging: `Information` level
   
2. **appsettings.Production.json** (production override)
   - Production database (via environment variables)
   - CORS: `["https://yourdomain.com"]`
   - Logging: `Warning` level

3. **Environment Variables** (override all)
   - `ASPNETCORE_ENVIRONMENT=Production` triggers Production config
   - Other settings can be overridden via env vars (e.g., `ConnectionStrings__DefaultConnection`)

### Frontend Configuration

1. **.env.development** (dev server, `npm run dev`)
   - `VITE_API_URL=https://localhost:7193`

2. **.env.production** (build output, `npm run build`)
   - `VITE_API_URL=https://api.yourdomain.com`

3. **.env.local** (git-ignored local overrides)
   - For testing different endpoints locally without committing

### How Vite Loads Env Files

- Vite loads `.env`, `.env.local`, `.env.[mode]`, `.env.[mode].local`
- For `npm run dev`, mode is `development`
- For `npm run build`, mode is `production`
- Local files override defaults

---

## Production Deployment

### Infrastructure Setup

```
Your Domain: yourdomain.com
├── Frontend (Static Files)
│   ├── Served from CDN or nginx
│   ├── .env.production: VITE_API_URL=https://api.yourdomain.com
│   └── Points API requests to /api
│
└── Backend API (Docker/Container)
    ├── Port 7193 (behind reverse proxy)
    ├── appsettings.Production.json loaded
    ├── CORS: AllowedOrigins=[https://yourdomain.com]
    └── Reverse proxy routes https://yourdomain.com/api/* to localhost:7193/*
```

### Reverse Proxy Example (nginx)

```nginx
upstream wpd_api {
  server localhost:7193;
}

server {
  listen 443 ssl;
  server_name yourdomain.com;

  # Frontend static files
  location / {
    root /var/www/wpd-client/dist;
    try_files $uri /index.html;
  }

  # API proxy
  location /api/ {
    proxy_pass https://wpd_api/;
    proxy_set_header Authorization $http_authorization;
    proxy_pass_header Authorization;
    proxy_ssl_verify off; # Or configure proper certificates
  }
}
```

### Environment Variables (Production)

```bash
# Deployment environment
ASPNETCORE_ENVIRONMENT=Production

# Database
ConnectionStrings__DefaultConnection=Server=prod-db-server;Database=WpdDb;User=wpd_user;Password=...

# Clerk
Clerk__Authority=https://your-clerk-instance.clerk.accounts.dev

# CORS (via appsettings.Production.json, can override here)
CORS__AllowedOrigins__0=https://yourdomain.com
```

---

## CORS Troubleshooting

### Development: "No 'Access-Control-Allow-Origin' header"

**Likely cause:** Frontend URL not in `CORS:AllowedOrigins`

**Fix:**
1. Check `.env.development` → `VITE_API_URL`
2. Check `appsettings.json` → `CORS:AllowedOrigins`
3. Ensure they match (both localhost:5173)
4. Restart backend after config changes

### Production: CORS errors after deployment

**Likely cause:** Frontend domain not in production CORS config

**Fix:**
1. Update `appsettings.Production.json` with actual domain
2. Or set `CORS__AllowedOrigins__0=https://yourdomain.com` env var
3. Restart API server
4. Verify frontend `VITE_API_URL` matches reverse proxy URL

---

## Local Testing Variations

### Test Backend on Different Machine

1. Frontend: `localhost:5173` (your dev machine)
2. Backend: `192.168.x.x:7193` (remote machine)

**Setup:**
```bash
# Backend appsettings.json
{
  "CORS": {
    "AllowedOrigins": ["http://localhost:5173", "http://192.168.x.x:*"]
  }
}

# Frontend .env.local
VITE_API_URL=https://192.168.x.x:7193
```

### Test Production Config Locally

```bash
# Backend: Set env var
$env:ASPNETCORE_ENVIRONMENT = "Production"

# Backend will load appsettings.Production.json
# Frontend: Use .env.production settings manually
VITE_API_URL=https://yourdomain.com
```

---

## Checklist: Before Production Deploy

- [ ] `appsettings.Production.json` has correct `CORS:AllowedOrigins`
- [ ] `.env.production` has correct `VITE_API_URL`
- [ ] Database connection string set via environment variable
- [ ] Clerk authority configured for production instance
- [ ] Reverse proxy correctly routes API traffic
- [ ] HTTPS certificates configured
- [ ] Test CORS with actual domain (not localhost)
- [ ] Test frontend can call API endpoints
