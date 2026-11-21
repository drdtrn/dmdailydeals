/**
 * Runs once when the server starts (Node runtime only). Initialising Payload here runs the
 * committed migrations (`prodMigrations`, production with PAYLOAD_DB_PUSH=false) at boot instead of
 * on the first visitor's request. `next build` must stay database-free, so nothing happens in the
 * build phase; a failed init at boot is logged and retried lazily by the first request.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  // Dev and tests run against a push-managed or throwaway database: only warm up in production.
  if (process.env.NODE_ENV !== 'production') return

  try {
    const [{ getPayload }, { default: config }] = await Promise.all([
      import('payload'),
      import('@payload-config'),
    ])
    await getPayload({ config })
    console.log('instrumentation: Payload initialised (migrations applied)')
  } catch (error) {
    console.error('instrumentation: Payload failed to initialise at boot', error)
  }
}
