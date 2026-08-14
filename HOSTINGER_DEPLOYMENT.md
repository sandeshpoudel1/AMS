# Hostinger Deployment

This repository is Docker-based, so the Hostinger path that fits best is a VPS or any server where you can run Docker, Docker Compose, PHP, Node.js, and PostgreSQL.

## Environment files

Copy these templates and replace the placeholders:

- `Backend/.devcontainer/app/.env.supabase.example` to `Backend/.devcontainer/app/.env`
- `Frontend/.env.hostinger.example` to `Frontend/.env.production`

For Supabase database connection, fill these values in `Backend/.devcontainer/app/.env`:

- `DB_HOST=db.pzraholsjdofhcjmgdoa.supabase.co`
- `DB_PORT=5432`
- `DB_DATABASE=postgres`
- `DB_USERNAME=postgres`
- `DB_PASSWORD=<your Supabase DB password>`
- `DB_SSLMODE=require`

Use your real domain in both files:

- `APP_URL=https://darkgoldenrod-rhinoceros-948310.hostingersite.com`
- `VITE_API_BASE_URL=https://darkgoldenrod-rhinoceros-948310.hostingersite.com/api`

## Build and deploy

1. Start the backend stack.

```bash
cd Backend/.devcontainer
docker compose up -d --build
```

2. Install PHP dependencies and run migrations.

```bash
docker compose exec app php artisan migrate --force
```

3. Build the frontend.

```bash
cd ../../Frontend
npm install
npm run build
```

4. Copy the frontend build into the backend public folder.

```bash
rsync -a --delete dist/ ../Backend/.devcontainer/app/public/
```

5. Restart the stack if needed.

```bash
cd ../Backend/.devcontainer
docker compose restart
```

## Notes

- Keep `APP_DEBUG=false` in production.
- Do not use `localhost` in the production env files.
- If you run the frontend and backend on the same domain, the API URL should point to that same domain with `/api` appended.
