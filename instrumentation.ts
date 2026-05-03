/**
 * Runs once per Next.js server instance (Node runtime).
 * Used to set up process-wide logging behavior.
 */

export const runtime = 'nodejs'

/** Logger already prefixes lines with [ISO] [LEVEL]; avoid double timestamps on console. */
function firstArgAlreadyTimestamped(args: unknown[]): boolean {
  const first = args[0]
  if (typeof first !== 'string') return false
  return /^\[\d{4}-\d{2}-\d{2}T[\d:.]+Z\] \[(INFO|WARN|ERROR|DEBUG|RATE-LIMIT)\]/.test(first)
}

function patchConsoleTimestampsOnce() {
  const g = globalThis as unknown as { __consoleTimestampsPatched?: boolean }
  if (g.__consoleTimestampsPatched) return
  g.__consoleTimestampsPatched = true

  const methods: Array<keyof Console> = ['log', 'info', 'warn', 'error', 'debug']

  for (const method of methods) {
    const original = (console[method] as unknown as (...args: any[]) => void).bind(console)
    console[method] = ((...args: any[]) => {
      if (firstArgAlreadyTimestamped(args)) {
        original(...args)
        return
      }
      const ts = new Date().toISOString()
      original(`[${ts}]`, ...args)
    }) as any
  }
}

export function register() {
  patchConsoleTimestampsOnce()
}

