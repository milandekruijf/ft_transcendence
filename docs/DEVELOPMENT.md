# Development

This document explains how to get the project running locally.

For the complete documentation map, see [Documentation](./README.md).

## Prerequisites

Install the host tools listed in [Prerequisites](./PREREQUISITES.md).

In short, local development needs:

1. Git.
2. Docker / Docker Desktop.
3. Vite+.

You do not need to install Bun manually. Vite+ manages Bun for the project.

## Install Vite+

Install Vite+ globally first:

### macOS / Linux

```bash
curl -fsSL https://vite.plus | bash
```

### Windows PowerShell

```powershell
irm https://vite.plus/ps1 | iex
```

Then clone and install:

```bash
git clone <repository-url>
cd ft_transcendence
vp install
```

## Start Development

Start the full development stack:

```bash
vp run dev
```

This task:

1. Starts the PostgreSQL and Redis services from the root Docker Compose stack.
2. Runs Drizzle migrations.
3. Generates shared tRPC types.
4. Generates frontend route and localization files.
5. Starts the backend and frontend in parallel.

```mermaid
flowchart TD
    A["vp run dev"]
    P["repo:dev:prepare"]
    B["repo:services:setup"]
    D["repo:trpc:generate"]
    E["repo:frontend:generate"]
    F["docker compose up -d --wait postgres redis"]
    H["Drizzle migrate"]
    I["Generate tRPC router types"]
    J["Generate routes and Paraglide runtime"]
    K["Start NestJS backend"]
    L["Start TanStack Start frontend"]

    A --> P
    P --> B
    P --> D
    P --> E
    B --> F
    B --> H
    D --> I
    E --> J
    A --> K
    A --> L
```

Open the frontend at:

```text
http://localhost:3000
```

The backend runs at:

```text
http://localhost:3001
```

## Fixture Mode Without Docker

For frontend and API development without Docker, PostgreSQL, or Redis, run:

```bash
vp run dev:fixtures
```

This mode:

1. Generates the shared tRPC types, frontend routes, and localization files.
2. Starts the NestJS backend with an in-memory user fixture store.
3. Uses in-memory cache and rate-limit storage.
4. Starts the frontend and backend with the usual ports.

Fixture changes last only for the current backend process and reset when it
restarts. The tRPC user queries, mutations, and subscriptions keep the same
contract as normal development.

Use the standard `vp run dev` command when testing PostgreSQL migrations, Redis
behavior, persistence, or the containerized service integration.

## Deploy Locally

Create the root `.env` once, then build and run the full containerized stack with
one command:

```bash
cp .env.example .env     # Compose reads ports and credentials from it
vp run deploy            # = docker compose up --build
```

For a background deployment, use `vp run deploy:detached`.

The backend runs the pending Drizzle migrations at startup (`DatabaseService.onModuleInit`),
and the one-shot `seed` Compose service inserts the demo accounts and events once the backend
reports healthy. A fresh clone therefore needs no manual `db:setup` or `db:seed` step; those
tasks remain for the non-Docker development flow.

## Useful Commands

| Command                  | Purpose                                   |
| ------------------------ | ----------------------------------------- |
| `vp run dev`             | Start the full development stack.         |
| `vp run dev:fixtures`    | Start fixture mode without Docker.        |
| `vp run dev:frontend`    | Start only the frontend.                  |
| `vp run dev:backend`     | Start database setup and the backend.     |
| `vp run deploy`          | Build and run the full Compose stack.     |
| `vp run deploy:detached` | Build and run the Compose stack detached. |
| `vp run services:setup`  | Start PostgreSQL and Redis, then migrate. |
| `vp run check`           | Run formatting, linting, and type checks. |
| `vp run check:fix`       | Fix formatting and safe lint issues.      |
| `vp run test`            | Run tests.                                |
| `vp run test:e2e`        | Run browser tests against the stack.      |
| `vp run build`           | Build all workspaces.                     |

For more commands, see [Tooling](./TOOLING.md).

## Database

The local database is PostgreSQL, managed by the root `docker-compose.yml` file.
Redis is also managed by Compose and is used by the backend for cache and throttling storage.

The default development connection string is:

```env
DATABASE_URL=postgres://transcendence:transcendence@localhost:5432/transcendence
```

You normally do not need to run migrations manually before development. `vp run dev` and `vp run dev:backend` both depend on database and Redis setup.

For database details, see [Database](./DATABASE.md).

## Current Example Flow

The first screen is a simple user form that demonstrates the core application flow:

1. TanStack Form validates input in the browser.
2. The shared Zod schema comes from `@repo/schemas`.
3. TanStack Query manages request and cache state.
4. tRPC calls the NestJS backend through generated router types.
5. The backend validates the same schema again.
6. Drizzle ORM reads and writes users in PostgreSQL.

For the full validation flow, see [Validation](./VALIDATION.md).

## Devcontainer

The devcontainer is planned for reproducible tooling and editor configuration.

It should install Vite+, install recommended editor extensions, configure port forwarding, and keep contributors on the same development environment.

PostgreSQL and Redis are not provided by the devcontainer. Infrastructure services are managed by the root Docker Compose stack.

For editor details, see [Editor](./EDITOR.md) and [Extensions](./EXTENSIONS.md).

## Troubleshooting

### Docker Is Not Running

Start Docker Desktop or your Docker daemon, then run:

```bash
docker compose up -d postgres
```

### Database Tables Are Missing

Run:

```bash
vp run db:migrate
```

### Generated tRPC Types Are Stale

Run:

```bash
vp run trpc:generate
```

### Redis Port Is Already In Use

The Compose stack maps Redis to host port `6380` by default because many systems
already use Redis's standard port `6379`. If `6380` is also occupied, choose
another host port:

```bash
REDIS_PORT=6381 vp run dev
```

### Commit Hook Fails

Run:

```bash
vp run check:fix
```

Then review and stage the resulting changes.

### `nestjs-trpc` Reports An Executable-Permission Error

```
Failed to execute nestjs-trpc CLI: spawnSync <repo-root>/node_modules/.bun/nestjs-trpc@2.10.0+4027ee5bbcdb762b/node_modules/nestjs-trpc/native/aarch64-apple-darwin/nestjs-trpc EACCES
```

Project installation fixes these permissions automatically. Run `vp install`
again. As a manual fallback, run:

```bash
chmod +x node_modules/.bun/nestjs-trpc@*/node_modules/nestjs-trpc/native/*/nestjs-trpc
```

### `nestjs-trpc` Reports `GLIBC_2.39 not found` On Linux

The packaged generator requires a newer GLIBC than some Linux distributions
provide. The repository vendors a compiled `nestjs-trpc` CLI at `bin/nestjs-trpc`
for this reason, and the tRPC generation tasks (`vp run trpc:generate`,
`vp run trpc:watch`) already use it instead of the packaged binary. See
[Tooling](./TOOLING.md#install).
