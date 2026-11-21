import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidateTag = vi.fn()
const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}))

import { revalidate } from '@/lib/revalidate'

const makeReq = (context: Record<string, unknown> = {}) =>
  ({
    context,
    payload: { logger: { warn: vi.fn(), debug: vi.fn() } },
  }) as unknown as Parameters<typeof revalidate>[0]['req']

describe('revalidate helper', () => {
  beforeEach(() => {
    revalidateTag.mockReset()
    revalidatePath.mockReset()
  })

  it('calls revalidateTag with the two-argument form and de-duplicates', () => {
    revalidate({ req: makeReq(), tags: ['a', 'a', null, false, 'b'], paths: ['/x'] })
    expect(revalidateTag.mock.calls).toEqual([
      ['a', 'max'],
      ['b', 'max'],
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/x')
  })

  it('does nothing when context.disableRevalidate is set', () => {
    revalidate({ req: makeReq({ disableRevalidate: true }), tags: ['a'], paths: ['/x'] })
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('never throws, and keeps going after a failing call', () => {
    revalidateTag.mockImplementationOnce(() => {
      throw new Error('Invariant: static generation store missing in revalidateTag("a")')
    })
    const req = makeReq()
    expect(() => revalidate({ req, tags: ['a', 'b'] })).not.toThrow()
    expect(revalidateTag).toHaveBeenCalledTimes(2)
    expect(req.payload.logger.debug).toHaveBeenCalledTimes(1)
  })

  it('warns on unexpected errors', () => {
    revalidatePath.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    const req = makeReq()
    revalidate({ req, paths: ['/x'] })
    expect(req.payload.logger.warn).toHaveBeenCalledTimes(1)
  })
})
