export const THEME_STORAGE_KEY = 'dm-theme'

/**
 * Runs in <head> before first paint: applies a saved light/dark choice to <html data-theme>.
 * With no saved choice nothing is set and the CSS follows prefers-color-scheme.
 */
export const themeInitScript = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`
