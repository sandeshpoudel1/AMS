# Deploy Project MOPL on Render — Step-by-step

This guide walks you through deploying the backend (Laravel) as a Docker Web Service and the frontend (Vite React) as a Static Site on Render, using the repository's `render.yaml` manifest or the Render dashboard.

Preflight checklist

- Ensure your `main` branch is pushed to GitHub (Render needs repo access).
- Generate a stable `APP_KEY` locally: from the backend app folder run `php artisan key:generate --show` and copy the value.
- Prepare secrets: database credentials, Redis (if used), mail provider, S3 keys (if used).

1. Connect repo to Render

- Open https://dashboard.render.com and click "New" → "Web Service" (or use the "Create from manifest" option if available).
- Connect your GitHub account and pick the `Project MOPL` repository and branch `main`.

2. Deploy the backend (recommended: Docker)

- Create a Web Service with these settings:
  - Name: `project-mopl-backend`
  - Environment: `Docker`
  - Branch: `main`
  - Dockerfile path: `Backend/.devcontainer/Dockerfile`
  - Root Directory: `/` (repo root)
  - Plan: Starter (or as needed)
  - Auto-deploy: on

- Environment variables: add the following (do NOT paste secrets into repo):
  - `APP_ENV`=production
  - `APP_KEY`=<paste the value generated locally>
  - `APP_URL`=https://api.YOURDOMAIN.com (or Render's generated URL)
  - `DATABASE_URL`=postgres://<user>:<pass>@<host>:<port>/<db>
  - `VITE_API_BASE_URL`=https://api.YOURDOMAIN.com/api
  - `CACHE_DRIVER`=redis
  - `SESSION_DRIVER`=redis
  - `QUEUE_CONNECTION`=redis
  - `REDIS_URL`=redis://<host>:<port>
  - `MAIL_MAILER`, `MAIL_HOST`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS` (if sending mail)

- Release Command (Render service settings → Advanced → Release Command). Recommended:

```bash
php artisan migrate --force
php artisan config:cache
php artisan route:cache
```

- Health check: set path `/health` (or `/`) that returns HTTP 200.

3. Deploy the frontend (Static Site)

- New → Static Site
  - Name: `project-mopl-frontend`
  - Branch: `main`
  - Build Command:

```bash
cd Frontend
npm ci
npm run build
```

- Publish Directory: `Frontend/dist`
- Add env var used at build time: `VITE_API_BASE_URL` = `https://api.YOURDOMAIN.com/api`

4. Create managed Postgres and Redis (optional)

- New → Databases → Postgres (name `project-mopl-db`) → copy connection string and put into backend `DATABASE_URL`.
- New → Databases → Redis (name `project-mopl-redis`) → copy `REDIS_URL` and set in backend env.

5. Domains & SSL

- Add custom domains for backend and frontend (Render provides managed SSL automatically).
- Set `SANCTUM_STATEFUL_DOMAINS` and `SESSION_DOMAIN` in backend env if using Sanctum.

6. Final checks & run

- After first deploy, open Render service logs to watch the build and release stage.
- If migrations fail, inspect logs and run one-off shell: Render → Shell and run `php artisan migrate --force`.

7. Troubleshooting

- Build fails due to missing PHP extensions: check Dockerfile and ensure runtime stage includes required extensions.
- `storage` permission errors: start script tries to `chown` storage and bootstrap/cache; if the user is different in the image, fix ownership in Dockerfile or runtime container.
- If your app needs background workers, add a Render Worker service with the same image and command:

```bash
php artisan queue:work --sleep=3 --tries=3 --daemon=false
```

8. Optional: apply the `render.yaml` manifest

- If you prefer manifest-driven deploys, use the Render Dashboard "Create from manifest" feature and paste the `render.yaml` contents. Edit the manifest to replace placeholder connection strings before applying.

9. Security

- Revoke any tokens accidentally posted publicly and create new PATs.
- Mark all Render env vars as secret where applicable.

Need help?

- I can fill `render.yaml` placeholders with the exact names/domains you want (I will not fill secrets). Provide your desired domain names and whether you want Postgres/Redis created by manifest or manually.
- I can also prepare a small `start_worker.sh` and a Render Worker manifest entry if you use queues.
