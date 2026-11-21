'use client'

import { Moon, Sun } from 'lucide-react'
import React from 'react'

import { themeCookie } from './theme'

/**
 * Switches between light and dark by writing <html data-theme> and remembering the choice in a cookie.
 * It holds no React state: the icon swap is pure CSS (.theme-icon-*), so there is nothing to
 * hydrate-mismatch and no effect to lint. Light is the default for everyone (the OS preference is ignored); dark is opt-in.
 */
export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const root = document.documentElement
    // Light is the default; dark is an explicit opt-in.
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark'
    root.dataset.theme = next
    // Remembered in a cookie so the server can render the right theme into the HTML.
    document.cookie = themeCookie(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark mode"
      className={className}
    >
      <Moon aria-hidden="true" strokeWidth={1.5} className="theme-icon-moon size-[18px]" />
      <Sun aria-hidden="true" strokeWidth={1.5} className="theme-icon-sun size-[18px]" />
    </button>
  )
}
