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

# Optional: CORS (defaults to allow all in production)
railway vars set FRONTEND_URL=
```

### 5. Deploy

```bash
railway up
```

Or push to a GitHub repo connected to Railway.

## Build Configuration

The deployment uses:

- **`Dockerfile`**: Multi-stage build that compiles the React frontend and packages it with the Node.js backend
- **`railway.toml`**: Explicitly sets `builder = "docker"` to bypass Nixpacks
- **Static file serving**: Backend serves the built frontend from `/public` directory

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Auto | Set by Railway PostgreSQL |
| `UNIAPI_KEY` | Yes | Your UniAPI key for OCR |
| `UNIAPI_BASE_URL` | Yes | `https://api.uniapi.io/v1` |
| `UNIAPI_MODEL` | Yes | `gemini-3-flash-preview` |
| `PORT` | No | Defaults to `10002` |
| `NODE_ENV` | No | Set to `production` automatically |

## How It Works

1. **Build Stage**: Dockerfile builds the frontend with Vite
2. **Runtime Stage**: Node.js backend starts and:
   - Connects to Railway PostgreSQL via `DATABASE_URL`
   - Initializes database schema automatically
   - Serves static frontend files on root path `/`
   - Serves API routes on `/api/*`
   - Handles SPA routing (all non-API routes → index.html)

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

### Build fails
Check Docker is available locally for testing:
```bash
docker build -t ee-expenses .
docker run -p 10002:10002 ee-expenses
```
