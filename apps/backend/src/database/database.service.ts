import { resolve } from 'node:path';
import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { schema } from '@repo/schemas/database';

// `src/database` in development, `dist/database` in the Docker image: both sit
// two levels below apps/backend, where the generated migrations live.
const migrationsFolder = resolve(__dirname, '../../drizzle');

@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;
  private readonly fixtures: boolean;
  readonly client;

  constructor(config: ConfigService) {
    this.fixtures = config.get<boolean>('DEV_FIXTURES') ?? false;
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      connectionTimeoutMillis: 2_000,
    });
    this.pool.on('error', (error) => {
      this.logger.error('Unexpected error on an idle PostgreSQL client', error.stack);
    });
    this.client = drizzle({
      client: this.pool,
      schema,
    });
  }

  // Applies the pending migrations from apps/backend/drizzle before any
  // request is served, so a freshly cloned stack creates its own tables.
  // Drizzle records applied migrations in drizzle.__drizzle_migrations — the
  // same table `drizzle-kit migrate` (vp run db:migrate) uses — so this is a
  // no-op on a database that is already up to date.
  //
  // Skipped in fixtures mode: there is no database to migrate, and connecting
  // here would stop the in-memory app from starting at all. The pool itself
  // connects lazily, so constructing it is harmless.
  async onModuleInit() {
    if (this.fixtures) {
      return;
    }

    await migrate(this.client, { migrationsFolder });
    this.logger.log('Database migrations are up to date');
  }

  async ping() {
    await this.pool.query('SELECT 1');
  }

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
