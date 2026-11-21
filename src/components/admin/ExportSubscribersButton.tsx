import React from 'react'

/** Download button above the subscribers list (beforeList). Uses the logged-in session cookie. */
export function ExportSubscribersButton() {
  return (
    <div style={{ margin: '0 0 var(--base)' }}>
      <a
        className="btn btn--style-secondary btn--size-medium"
        href="/api/subscribers/export"
        download
        data-testid="export-subscribers"
        style={{ display: 'inline-block', textDecoration: 'none' }}
      >
        <span className="btn__content">
          <span className="btn__label">Export CSV</span>
        </span>
      </a>
    </div>
  )
}
