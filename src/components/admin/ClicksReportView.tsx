import type { AdminViewServerProps } from 'payload'

import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import React from 'react'

import { type ClickWindow, formatUtc, getClickReport } from '@/lib/reports/clicks'

import './clicksReport.scss'

export const CLICKS_REPORT_PATH = '/reports/clicks'

function Table({
  caption,
  head,
  rows,
}: {
  caption: string
  head: string[]
  rows: (string | number)[][]
}) {
  return (
    <table className="clicks-report__table">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={h} className={i === head.length - 1 ? 'is-num' : undefined}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={head.length}>No clicks in this period.</td>
          </tr>
        ) : (
          rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (
                <td key={i} className={i === row.length - 1 ? 'is-num' : undefined}>
                  {cell}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}

function WindowSection({ window: w }: { window: ClickWindow }) {
  return (
    <section className="clicks-report__window" data-testid={`clicks-window-${w.days}`}>
      <h2>Last {w.days} days</h2>
      <p className="clicks-report__range">
        {formatUtc(w.from)} to {formatUtc(w.to)} (UTC, rolling {w.days} × 24 hours)
      </p>
      <p className="clicks-report__totals">
        <strong data-testid={`clicks-total-${w.days}`}>{w.total}</strong> clicks by people
        <span className="clicks-report__bots">
          {' '}
          · <span data-testid={`clicks-bots-${w.days}`}>{w.bots}</span> bot clicks (not counted)
        </span>
      </p>
      <Table
        caption="Clicks per store"
        head={['Store', 'Clicks']}
        rows={w.perStore.map((r) => [r.name, r.clicks])}
      />
      <Table
        caption="Clicks per deal"
        head={['Deal', 'Store', 'Clicks']}
        rows={w.perDeal.map((r) => [r.title, r.storeName, r.clicks])}
      />
      <Table
        caption="Top pages the clicks came from"
        head={['Page', 'Clicks']}
        rows={w.topPaths.map((r) => [r.path, r.clicks])}
      />
    </section>
  )
}

/** /admin/reports/clicks: outbound clicks per store and deal for the last 7 and 30 days. */
export async function ClicksReportView({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) {
  const { req } = initPageResult
  // Custom views are public by default: only logged-in users may see this one.
  if (!req.user) {
    redirect(`/admin/login?redirect=${encodeURIComponent(`/admin${CLICKS_REPORT_PATH}`)}`)
  }

  const report = await getClickReport(req.payload)

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={req.user}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <div className="clicks-report">
          <h1>Outbound clicks</h1>
          <p>
            Clicks on <code>/go/&lt;deal&gt;</code> links, as logged when a visitor leaves for a
            store. Bot traffic is detected from the user agent and excluded from every figure except
            the separate bot count. All times are UTC. Generated {formatUtc(report.generatedAt)}.
          </p>
          {report.windows.map((w) => (
            <WindowSection key={w.days} window={w} />
          ))}
        </div>
      </Gutter>
    </DefaultTemplate>
  )
}
