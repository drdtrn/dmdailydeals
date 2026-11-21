import { act, cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

import { Countdown } from '@/components/deals/Countdown'

const TARGET = '2026-11-22T14:00:00.000Z' // 09:00 EST

beforeEach(() => {
  refresh.mockClear()
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Countdown', () => {
  it('server-renders meaningful, clock-free markup', () => {
    // No Date.now() during render: the output is the same whatever time it is.
    vi.setSystemTime(new Date('2026-11-22T10:00:00.000Z'))
    const a = renderToString(<Countdown target={TARGET} />)
    vi.setSystemTime(new Date('2026-11-22T13:59:59.000Z'))
    const b = renderToString(<Countdown target={TARGET} />)
    expect(a).toBe(b)
    expect(a).toContain(`<time dateTime="${TARGET}">Sun, Nov 22, 9:00 AM ET</time>`)
    expect(a).toContain('--')
    expect(a).not.toContain('aria-live')
  })

  it('ticks down once mounted', async () => {
    vi.setSystemTime(new Date('2026-11-22T12:58:55.000Z')) // 1h 1m 5s before
    render(<Countdown target={TARGET} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    const timer = screen.getByRole('timer')
    expect(timer.textContent).toContain('01')
    expect(timer.textContent).toContain('05')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(screen.getByRole('timer').textContent).toContain('04')
  })

  it('refreshes after zero, at most a few times', async () => {
    vi.setSystemTime(new Date('2026-11-22T13:59:58.000Z'))
    render(<Countdown target={TARGET} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(refresh).not.toHaveBeenCalled()

    // Zero at +2s; the first refresh comes 5s later.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000)
    })
    expect(refresh).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })
    expect(refresh).toHaveBeenCalledTimes(1)

    // No refresh loop: retries are spaced 15s apart and capped.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(refresh).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000)
    })
    expect(refresh).toHaveBeenCalledTimes(4)
    expect(screen.getByRole('timer').textContent).toContain('00')
  })

  it('restarts the refresh budget when the server sends a new target', async () => {
    vi.setSystemTime(new Date('2026-11-22T14:01:00.000Z'))
    const { rerender } = render(<Countdown target={TARGET} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(refresh).toHaveBeenCalledTimes(1)
    rerender(<Countdown target="2026-11-23T14:00:00.000Z" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('timer').textContent).toContain('23')
  })
})
