# MORMS — Motherland Overseas Record Management System

A full-stack overseas manpower management platform built with **Laravel 13 + PostgreSQL** (backend) and **React + Vite** (frontend), running inside Docker.

---

## Tech Stack

| Layer     | Technology                              |
| --------- | --------------------------------------- |
| Frontend  | React 18, Vite, React Router            |
| Backend   | Laravel 13, PHP 8.2, Sanctum (API auth) |
| Database  | PostgreSQL 15                           |
| Server    | Nginx (inside Docker)                   |
| Container | Docker + Docker Compose                 |

---

## Prerequisites — Windows Laptop Setup

Complete these steps in order before anything else.

### Step 1 — Install Git for Windows

- Download: https://git-scm.com/download/win
- Run the installer, keep all defaults
- This also installs **Git Bash** — use Git Bash for all commands below (not CMD, not PowerShell)

### Step 2 — Install Docker Desktop

- Download: https://www.docker.com/products/docker-desktop
- Requires Windows 10 or 11 (64-bit)
- During install, select **"Use WSL 2 instead of Hyper-V"** when prompted
- After install, open **Docker Desktop** from the Start menu
- Wait until the bottom-left says **"Engine running"** before continuing — this is important

### Step 3 — Install Node.js

- Download the **LTS** version: https://nodejs.org
- Run the installer, keep all defaults

### Step 4 — Verify everything works

Open **Git Bash** and run these one by one:

```bash
git --version
docker --version
node --version
npm --version
```

All four should print version numbers. If Docker says `"command not found"`, make sure Docker Desktop is open and the engine is running.

---

## Local Setup (Step by Step)

### 1. Clone the repository

```bash
git clone https://github.com/motherlandgroupsocialmedia-ux/MORMS.git
cd MORMS
```

### 2. Create the backend environment file

Open **Git Bash** and run:

```bash
cp Backend/.devcontainer/app/.env.local.example Backend/.devcontainer/app/.env
```

> The defaults in this file already match the Docker services — no changes needed for local dev.

### 3. Start the backend (Docker)

Make sure **Docker Desktop is open and the engine is running**, then run:

```bash
cd Backend/.devcontainer
docker compose up -d --build
```

> First run downloads images and builds containers — takes **3–5 minutes**. You will see lots of output. Wait until the command prompt returns.

This starts:

- **morms_app** — Laravel PHP-FPM
- **morms_nginx** — Nginx on http://localhost:8000
- **morms_postgres** — PostgreSQL on port 5432
- **morms_postgres** — PostgreSQL on port 5432

First build takes 3–5 minutes. After that, subsequent starts are instant.

### 4. Run migrations and seed default data

```bash
docker compose exec app php artisan migrate --force
docker compose exec app php artisan db:seed --force
```

### 5. Install frontend dependencies and start dev server

Open a **second Git Bash window** (keep the first one for Docker), then:

```bash
cd MORMS/Frontend
npm install
npm run dev
```

Open your browser and go to: **http://localhost:3000**

---

## Default Login Accounts

After seeding, these accounts are available:

| Role              | Email                         | Password          |
| ----------------- | ----------------------------- | ----------------- |
| Admin             | `admin@mopl.test`             | `Admin@12345`     |
| Finance Officer   | `finance.officer@mopl.test`   | `Finance@12345`   |
| Candidate Officer | `candidate.officer@mopl.test` | `Candidate@12345` |

---

## Modules

| Module              | Description                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| Dashboard           | Live stats — candidates, deployments, activity feed                         |
| Candidates          | Full candidate lifecycle with passport, documents, history                  |
| Document Controller | Upload, preview, bulk delete, batch ZIP download, inline title edit         |
| Visa Processing     | Fee tracking, advance payments, document charges, P&L per candidate         |
| Daily Daybook       | Ledger with receipt/payment entries linked to Visa, Candidates, Staff, etc. |
| Finance             | Candidate payment tracking, miscellaneous expenses                          |
| Payroll             | Staff salary records and payment tracking                                   |
| Staff               | Staff profiles, employment type, salary                                     |
| Clients / Agencies  | Client/agency management                                                    |
| BD                  | Business development source tracking                                        |
| Reference           | Reference source management                                                 |
| Reports             | Revenue, candidate, visa pipeline, payroll summaries                        |
| Security            | 2FA setup (TOTP)                                                            |

---

## Stopping the stack

In Git Bash, go to the Backend folder and stop Docker:

```bash
cd MORMS/Backend/.devcontainer
docker compose down
```

To also wipe the database and start fresh next time:

```bash
docker compose down -v
```

---

## Common Windows Problems

| Problem                            | Fix                                                       |
| ---------------------------------- | --------------------------------------------------------- |
| `docker: command not found`        | Open Docker Desktop and wait for "Engine running"         |
| `port 8000 already in use`         | Another app is using port 8000 — restart Docker Desktop   |
| `npm: command not found`           | Reinstall Node.js from https://nodejs.org                 |
| Backend 500 error on login         | Run `docker compose exec app php artisan migrate --force` |
| Page not loading at localhost:3000 | Run `npm run dev` inside the Frontend folder              |
| `cp` command not found             | Make sure you are using Git Bash, not CMD                 |

---

## Useful Docker commands

```bash
# View logs
docker compose logs -f app

# Run artisan commands
docker compose exec app php artisan <command>

# Open a shell inside the container
docker compose exec app bash

# Rebuild after code changes
docker compose up -d --build
```

---

## Production Deployment

See [HOSTINGER_DEPLOYMENT.md](HOSTINGER_DEPLOYMENT.md) for VPS/Hostinger deployment steps.

## Supabase Connection (Backend)

To use Supabase Postgres instead of local Postgres:

1. Copy the Supabase template:

```bash
cp Backend/.devcontainer/app/.env.supabase.example Backend/.devcontainer/app/.env
```

2. Set your Supabase DB password in `Backend/.devcontainer/app/.env`:

```env
DB_PASSWORD=your_database_password
```

3. Clear config cache and run migrations:

```bash
cd Backend/.devcontainer/app
php artisan config:clear
php artisan migrate --force
```
# Project-MOPL
