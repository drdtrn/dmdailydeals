'use client'

import { Moon, Sun } from 'lucide-react'
import React from 'react'

import { THEME_STORAGE_KEY } from './theme'

/**
 * Switches between light and dark by writing <html data-theme> and remembering the choice.
 * It holds no React state: the icon swap is pure CSS (.theme-icon-*), so there is nothing to
 * hydrate-mismatch and no effect to lint. Before the first choice the site follows the OS.
 */
export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const root = document.documentElement
    const current =
      root.dataset.theme ??
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    const next = current === 'dark' ? 'light' : 'dark'
    root.dataset.theme = next
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Private mode or blocked storage: the choice just lasts for this page view.
    }
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
