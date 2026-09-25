# Environment

This document lists the environment variables currently used by the project.

## Backend

The backend uses `@nestjs/config` and loads environment files in this order:

1. `apps/backend/.env`
2. `.env`
3. `apps/backend/.env.development`
4. `.env.development`

Earlier files take precedence when the same variable is defined.

### Variables

| Variable               | Required                   | Default Development Value                                             | Purpose                                                                                                                                                                                                           |
| ---------------------- | -------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`             | No                         | `development`                                                         | Selects development, production, or test behavior.                                                                                                                                                                |
| `DATABASE_URL`         | Unless `DEV_FIXTURES=true` | `postgres://transcendence:transcendence@localhost:5432/transcendence` | PostgreSQL connection string used by the backend and Drizzle Kit.                                                                                                                                                 |
| `PORT`                 | No                         | `3001`                                                                | Backend HTTP port.                                                                                                                                                                                                |
| `REDIS_URL`            | No                         | `redis://localhost:6380`                                              | Redis connection string for backend cache and throttling storage.                                                                                                                                                 |
| `BETTER_AUTH_SECRET`   | Yes                        | (see `apps/backend/.env.development`)                                 | Signing secret for Better Auth sessions and tokens. See [Authentication](./AUTHENTICATION.md).                                                                                                                    |
| `BETTER_AUTH_URL`      | No                         | `http://localhost:3001`                                               | The backend's public base URL, used by Better Auth to build absolute links and to decide on `Secure` cookies. Behind Caddy this is the HTTPS origin (`https://localhost:3000`).                                   |
| `CACHE_TTL_MS`         | No                         | `30000`                                                               | Default backend cache TTL in milliseconds.                                                                                                                                                                        |
| `THROTTLE_TTL_SECONDS` | No                         | `60`                                                                  | Rate-limit window length in seconds.                                                                                                                                                                              |
| `THROTTLE_LIMIT`       | No                         | `100`                                                                 | Maximum requests allowed during the throttle window.                                                                                                                                                              |
| `THROTTLE_ENABLED`     | No                         | `false`                                                               | Enables the global rate limiter. `.env.development` disables it; `.env.example` enables it, so Docker Compose runs with it on. A root `.env` takes precedence, so local development throttles too once it exists. |
| `DEV_FIXTURES`         | No                         | `false`                                                               | Use in-memory users, cache, and throttling without PostgreSQL or Redis.                                                                                                                                           |
| `CORS_ORIGINS`         | No                         | `http://localhost:3000`                                               | Comma-separated browser origins allowed to call the backend (also Better Auth's trusted origins).                                                                                                                 |
| `SEED_ADMIN_PASSWORD`  | Yes                        | (see `apps/backend/.env.development`)                                 | Password for the seeded admin user created by `vp run db:seed`.                                                                                                                                                   |
| `SEED_DIDI_PASSWORD`   | Yes                        | (see `apps/backend/.env.development`)                                 | Password for a seeded demo user created by `vp run db:seed`.                                                                                                                                                      |
| `SEED_HOMER_PASSWORD`  | Yes                        | (see `apps/backend/.env.development`)                                 | Password for a seeded demo user created by `vp run db:seed`.                                                                                                                                                      |

The committed development fallback lives in:

```text
apps/backend/.env.development
```

Local secrets or overrides should go into ignored `.env` files. Paths are
resolved from the repository and backend directories rather than the command's
working directory. Invalid values stop the application during startup.

The `dev:fixtures` task sets `DEV_FIXTURES=true` for the backend process. This
mode is intended for UI and API-contract development; its data resets whenever
the backend restarts.

## Drizzle Kit

Drizzle Kit reads the same `DATABASE_URL` through `apps/backend/drizzle.config.ts`.

The config loads:

1. `apps/backend/.env`
2. `.env`
3. `apps/backend/.env.development`

## Frontend

The frontend uses `@t3-oss/env-core`.

Client-side variables must use the `VITE_` prefix.

| Variable         | Required | Purpose                                                                                                                                                                                  |
| ---------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_APP_TITLE` | No       | Optional frontend application title.                                                                                                                                                     |
| `VITE_API_URL`   | No       | Backend origin the browser calls. Build-time only. Unset, a production build uses the page's own origin (`/api/...` through Caddy) and the Vite dev server uses `http://localhost:3001`. |
| `SERVER_URL`     | No       | Backend origin the frontend server calls during SSR. Read at runtime from the process environment (`http://backend:3001` in Compose).                                                    |

How the frontend picks the backend URL lives in one place:
[`apps/frontend/src/lib/api-base-url.ts`](../apps/frontend/src/lib/api-base-url.ts).

## Compose Variables

The root `docker-compose.yml` reads these from the root `.env` file, which has to
exist before `docker compose up` (`cp .env.example .env`). Without it, Compose
warns that each variable is unset and the stack fails to start.

| Variable            | `.env.example` value     | Purpose                                                                                                                    |
| ------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `POSTGRES_DB`       | `transcendence`          | PostgreSQL database name.                                                                                                  |
| `POSTGRES_USER`     | `transcendence`          | PostgreSQL user.                                                                                                           |
| `POSTGRES_PASSWORD` | `transcendence`          | PostgreSQL password.                                                                                                       |
| `HTTPS_PORT`        | `3000`                   | Host port Caddy serves HTTPS on.                                                                                           |
| `HTTP_PORT`         | `3080`                   | Host port Caddy serves the HTTP → HTTPS redirect on.                                                                       |
| `PUBLIC_ORIGIN`     | `https://localhost:3000` | Origin the app is opened on. Fed to the backend as `BETTER_AUTH_URL` and `CORS_ORIGINS`; its port must match `HTTPS_PORT`. |
| `SEED_*_PASSWORD`   | (dev values in Compose)  | Seed-user passwords the backend requires at startup; see the backend table above. Optional: Compose keeps a default.       |
| `POSTGRES_PORT`     | `5432`                   | Host port mapped to PostgreSQL.                                                                                            |
| `REDIS_PORT`        | `6380`                   | Host port mapped to Redis.                                                                                                 |
| `MAILPIT_SMTP_PORT` | `1025`                   | Host port mapped to Mailpit's SMTP listener.                                                                               |
| `MAILPIT_UI_PORT`   | `8025`                   | Host port mapped to Mailpit's web UI.                                                                                      |

The frontend and backend containers publish no host ports; Caddy is the only entry
point to the application.

The defaults stay above 1024 because rootless Docker (Codam machines) cannot bind
lower ports. To serve on the standard ports instead, put this in the root `.env` and
open `https://localhost`:

```text
HTTP_PORT=80
HTTPS_PORT=443
PUBLIC_ORIGIN=https://localhost
```
