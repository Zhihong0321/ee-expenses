# Railway Deployment Guide (Docker Build - No Nixpacks)

This guide explains how to deploy EE-Expenses to Railway using a Dockerfile-based build.

## Prerequisites

- Railway CLI installed (`npm i -g @railway/cli`)
- Railway account with a project created

## Deployment Steps

### 1. Login to Railway

```bash
railway login
```

### 2. Link to your project

```bash
railway link
```

### 3. Add PostgreSQL Database

In Railway dashboard or CLI:
```bash
railway add --database postgres
```

This automatically sets the `DATABASE_URL` environment variable.

### 4. Set Required Environment Variables

```bash
# Required for OCR functionality
railway vars set UNIAPI_KEY=your_uniapi_key_here
railway vars set UNIAPI_BASE_URL=https://api.uniapi.io/v1
railway vars set UNIAPI_MODEL=gemini-3-flash-preview

# Required for Auth Hub integration (atap.solar SSO)
railway vars set JWT_SECRET=your_shared_jwt_secret_here
railway vars set AUTH_URL=https://auth.atap.solar

# Optional: CORS (defaults to allow all in production)
railway vars set FRONTEND_URL=
```

### 5. Deploy

**Option A: Deploy from GitHub (Recommended)**
1. Connect your GitHub repo in Railway dashboard
2. Railway auto-detects the `Dockerfile`
3. Deploy triggers automatically on push

**Option B: Deploy via CLI**
```bash
railway up
```

## Build Configuration

The deployment uses:

- **`Dockerfile`**: Multi-stage build that compiles the React frontend and packages it with the Node.js backend (Railway auto-detects this)
- **Static file serving**: Backend serves the built frontend from `/public` directory

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Auto | Set by Railway PostgreSQL |
| `UNIAPI_KEY` | Yes | Your UniAPI key for OCR |
| `UNIAPI_BASE_URL` | Yes | `https://api.uniapi.io/v1` |
| `UNIAPI_MODEL` | Yes | `gemini-3-flash-preview` |
| `JWT_SECRET` | Yes | Shared JWT secret with auth.atap.solar |
| `AUTH_URL` | No | Auth hub URL (default: `https://auth.atap.solar`) |
| `PORT` | No | Defaults to `10002` |
| `NODE_ENV` | No | Set to `production` automatically |

## Auth Hub Integration

This app integrates with `auth.atap.solar` for centralized authentication:

1. User visits your app at `https://expenses.atap.solar`
2. App checks for `auth_token` cookie
3. If missing, redirects to `https://auth.atap.solar/?return_to=https://expenses.atap.solar`
4. User logs in via WhatsApp OTP on Auth Hub
5. Auth Hub sets cookie and redirects back to `expenses.atap.solar`
6. App verifies JWT and logs user in

### Return URL Configuration

The return URL is automatically set based on the current domain. Ensure your app is hosted at:
```
expenses.atap.solar
```

And the Auth Hub is configured to allow this domain as a valid return URL.

### User Data Isolation

- All receipts are tied to the authenticated user's ID
- Users can only see their own receipts and expenses
- Admin users (with `isAdmin: true` in JWT) can access admin routes

## How It Works

1. **Build Stage**: Dockerfile builds the frontend with Vite
2. **Runtime Stage**: Node.js backend starts and:
   - Connects to Railway PostgreSQL via `DATABASE_URL`
   - Initializes database schema automatically
   - Serves static frontend files on root path `/`
   - Serves API routes on `/api/*`
   - Handles SPA routing (all non-API routes → index.html)
   - Validates JWT tokens from Auth Hub

## Troubleshooting

### Check logs
```bash
railway logs
```

### Health check endpoint
```
GET /health
```

### Database connection issues
Ensure `DATABASE_URL` is set:
```bash
railway vars
```

### Auth issues
Ensure `JWT_SECRET` matches the Auth Hub's secret:
```bash
railway vars set JWT_SECRET=your_secret
```

### Build fails
Check Docker is available locally for testing:
```bash
docker build -t ee-expenses .
docker run -p 10002:10002 ee-expenses
```
