let installed = false

function tsPrefix(level: string) {
  return `[${new Date().toISOString()}] [${level}]`
}

function normalizeArgs(args: unknown[]) {
  if (args.length === 0) return ['']
  // Join into a single string so we can ensure the first line is prefixed.
  return [args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')]
}

/**
 * Patch console.* so each emitted line starts with an ISO timestamp.
 * Server-only: imported from `app/layout.tsx` for dev/prod Node logs.
 */
export function installConsoleTimestampPrefix() {
  if (installed) return
  installed = true

  const origLog = console.log.bind(console)
  const origWarn = console.warn.bind(console)
  const origError = console.error.bind(console)

  console.log = (...args: unknown[]) => origLog(tsPrefix('INFO'), ...normalizeArgs(args))
  console.warn = (...args: unknown[]) => origWarn(tsPrefix('WARN'), ...normalizeArgs(args))
  console.error = (...args: unknown[]) => origError(tsPrefix('ERROR'), ...normalizeArgs(args))
}

