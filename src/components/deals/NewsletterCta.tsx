'use client'

import { Send } from 'lucide-react'
import React, { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/utilities/ui'

type Status = 'idle' | 'sending' | 'success' | 'error'

type Props = {
  /** Which page or placement this form is on; stored with the subscriber (`source`). */
  source: string
  /** Telegram channel URL; the link is omitted without it. */
  telegramUrl?: string
  heading?: string
  description?: string
  /** Unique per page when the form appears twice (label/input ids). */
  id?: string
  headingLevel?: 'h2' | 'h3'
  className?: string
}

/**
 * Email signup. Copy is honest: daily emails have not started, so we promise a heads-up when
 * they do. The form posts to /api/subscribe (built in Phase 7); until then the handler shows
 * a friendly error. Without JS the native form submit goes to the same endpoint.
 */
export function NewsletterCta({
  source,
  telegramUrl,
  heading = 'Get the drop by email',
  description = 'Daily emails haven’t started yet. Join the list and we’ll email you when daily drops start, at 9:00 AM ET. Unsubscribe anytime.',
  id = 'newsletter',
  headingLevel: Heading = 'h2',
  className,
}: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const inputId = `${id}-email`

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setStatus('sending')
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: data.get('email'),
          source: data.get('source'),
          website: data.get('website'),
        }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      form.reset()
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  return (
    <section
      id={id}
      data-theme="dark"
      aria-labelledby={`${id}-heading`}
      className={cn('min-w-0 bg-ink px-5 py-8 text-foreground md:rounded-md md:p-9', className)}
    >
      <Heading
        id={`${id}-heading`}
        className="font-display text-[28px] leading-[1.15] font-medium md:text-4xl md:leading-[1.1]"
      >
        {heading}
      </Heading>
      <p className="mt-2.5 text-soft-foreground md:mt-3">{description}</p>

      <form
        method="post"
        action="/api/subscribe"
        onSubmit={onSubmit}
        className="mt-[18px] md:mt-[22px]"
      >
        <input type="hidden" name="source" value={source} />
        {/* Honeypot: invisible to people, tempting to bots. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor={`${id}-website`}>Website</label>
          <input id={`${id}-website`} type="text" name="website" tabIndex={-1} autoComplete="off" />
        </div>

        <Label htmlFor={inputId}>Email address</Label>
        <div className="mt-2 flex flex-col gap-2.5 md:flex-row md:flex-wrap">
          <Input
            id={inputId}
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="bg-background md:h-[50px] md:min-w-[240px] md:flex-1"
          />
          <Button type="submit" disabled={status === 'sending'} className="md:h-[50px] md:px-6">
            {status === 'sending' ? 'Joining…' : 'Join the list'}
          </Button>
        </div>
        <p
          role="status"
          className={cn(
            'mt-3 min-h-5 text-sm',
            status === 'error' ? 'text-destructive' : 'text-soft-foreground',
          )}
        >
          {status === 'success'
            ? 'You are on the list. We will email you when daily drops start.'
            : status === 'error'
              ? 'We could not add you just now. Please try again later.'
              : ''}
        </p>
      </form>

      {telegramUrl ? (
        <a
          href={telegramUrl}
          rel="noopener"
          className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-foreground underline-offset-4 hover:underline"
        >
          <Send aria-hidden="true" strokeWidth={1.5} className="size-[18px]" />
          Follow the drop on Telegram
        </a>
      ) : null}
    </section>
  )
}
