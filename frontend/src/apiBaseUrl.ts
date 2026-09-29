const configured = (import.meta.env.VITE_API_BASE_URL ?? '').trim()

/**
 * In a production build the app is served from the same origin as the API, so an
 * unset or empty value means "same origin". Falling back to localhost there
 * would build a page that silently calls the visitor's own machine, which fails
 * as a confusing CORS error rather than a configuration error.
 */
export const apiBaseUrl = configured || (import.meta.env.PROD ? '' : 'http://localhost:3000')

if (import.meta.env.PROD && /^https?:\/\/(localhost|127\.0\.0\.1)/.test(configured)) {
  console.warn(
    '[config] VITE_API_BASE_URL points at localhost in a production build. The app will call the ' +
      "visitor's own machine instead of the API. Leave it empty when the backend serves this app.",
  )
}
