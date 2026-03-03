# Required environment variables on Vercel

Set these in **Vercel → Project → Settings → Environment Variables** (for Production and Preview).

## Required for admin login and rate limiting

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret for signing admin session JWTs. **Must be set** or login returns 500. Use a long random string (e.g. same as `SUPABASE_JWT_SECRET` or generate a new one). |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST API URL (e.g. `https://fancy-tomcat-21098.upstash.io`). |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST API token. |

## Also required for the app

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

If `UPSTASH_*` or `JWT_SECRET` are missing, login can fail with "Rate limit check failed" or "JWT_SECRET environment variable is required".
