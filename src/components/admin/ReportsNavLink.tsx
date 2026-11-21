import Link from 'next/link'
import React from 'react'

/** Adds "Click report" under the collection links in the admin nav (afterNavLinks). */
export function ReportsNavLink() {
  return (
    <div style={{ marginTop: 'calc(var(--base) / 2)' }}>
      <Link className="nav__link" href="/admin/reports/clicks" prefetch={false}>
        <span className="nav__link-label">Click report</span>
      </Link>
    </div>
  )
}
