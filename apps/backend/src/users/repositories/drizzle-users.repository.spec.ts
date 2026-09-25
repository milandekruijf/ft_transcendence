import { describe, expect, it, vi } from 'vitest';

import type { Database } from '../../database/database.types';
import { UserEmailAlreadyExistsError } from '../errors/user-email-already-exists.error';
import { UserUsernameAlreadyExistsError } from '../errors/user-username-already-exists.error';
import { DrizzleUsersRepository } from './drizzle-users.repository';

const ada = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  username: 'ada_lovelace',
};

// A database whose insert fails with `error`, the way the driver would.
function databaseRejecting(error: unknown) {
  const returning = vi.fn().mockRejectedValue(error);

  return {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning,
      })),
    })),
  } as unknown as Database;
}

describe('DrizzleUsersRepository', () => {
  it('translates a duplicate email into a domain error', async () => {
    const repository = new DrizzleUsersRepository(
      databaseRejecting({ code: '23505', constraint: 'users_email_unique' }),
    );

    await expect(repository.create(ada)).rejects.toBeInstanceOf(UserEmailAlreadyExistsError);
  });

  it('translates a duplicate username into a domain error', async () => {
    const repository = new DrizzleUsersRepository(
      databaseRejecting({ code: '23505', constraint: 'users_username_unique' }),
    );

    await expect(repository.create(ada)).rejects.toBeInstanceOf(UserUsernameAlreadyExistsError);
  });

  // Drizzle wraps the driver error and keeps the original as `cause`.
  it('finds the PostgreSQL error inside a Drizzle wrapper', async () => {
    const repository = new DrizzleUsersRepository(
      databaseRejecting(
        new Error('Failed query', {
          cause: { code: '23505', constraint: 'users_email_unique' },
        }),
      ),
    );

    await expect(repository.create(ada)).rejects.toBeInstanceOf(UserEmailAlreadyExistsError);
  });

  it('does not guess which field clashed when the constraint is unknown', async () => {
    const databaseError = { code: '23505', constraint: 'some_other_unique' };
    const repository = new DrizzleUsersRepository(databaseRejecting(databaseError));

    await expect(repository.create(ada)).rejects.toBe(databaseError);
  });

  it('does not hide unexpected database failures', async () => {
    const databaseError = new Error('Database unavailable');
    const repository = new DrizzleUsersRepository(databaseRejecting(databaseError));

    await expect(repository.create(ada)).rejects.toBe(databaseError);
  });
});
