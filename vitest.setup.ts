// Test setup. Runs before every test file, so it must finish configuring the environment
// before `payload.config` is imported.
import 'dotenv/config'

import os from 'os'
import path from 'path'

/**
 * Integration tests must never touch the dev database. They use their own database:
 * - `TEST_DATABASE_URL` if set, otherwise
 * - `DATABASE_URL` with `_test` appended to the database name (dmdailydeals -> dmdailydeals_test).
 *
 * Create it once:  docker exec dmdailydeals-postgres-1 psql -U dmdd -d postgres -c 'CREATE DATABASE dmdailydeals_test'
 * Locally the schema is created by Payload's dev push. In CI the database is migrated first and
 * the workflow sets PAYLOAD_DB_PUSH=false.
 */
function resolveTestDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL
  const dev = process.env.DATABASE_URL
  if (!dev) throw new Error('Set DATABASE_URL (or TEST_DATABASE_URL) to run the tests.')
  const url = new URL(dev)
  if (!url.pathname.endsWith('_test')) url.pathname = `${url.pathname}_test`
  return url.toString()
}

const testUrl = resolveTestDatabaseUrl()
const dbName = decodeURIComponent(new URL(testUrl).pathname.replace(/^\//, ''))

// The tests delete rows, so refuse anything that is not clearly a throwaway database.
// (CI uses a fresh service container database.)
if (!dbName.endsWith('_test') && process.env.CI !== 'true') {
  throw new Error(
    `Refusing to run integration tests against "${dbName}": the database name must end in _test (or run in CI).`,
  )
}

process.env.DATABASE_URL = testUrl
process.env.PAYLOAD_SECRET ||= 'test-only-payload-secret'
// Keep test uploads out of the repo's media folder.
process.env.PAYLOAD_MEDIA_DIR ||= path.join(os.tmpdir(), 'dmdailydeals-test-media')
