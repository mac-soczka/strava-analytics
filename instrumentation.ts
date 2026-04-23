/**
 * Runs once per Next.js server instance (Node runtime).
 * Used to set up process-wide logging behavior.
 */

export const runtime = 'nodejs'

function patchConsoleTimestampsOnce() {
  const g = globalThis as unknown as { __consoleTimestampsPatched?: boolean }
  if (g.__consoleTimestampsPatched) return
  g.__consoleTimestampsPatched = true

  const methods: Array<keyof Console> = ['log', 'info', 'warn', 'error', 'debug']

  for (const method of methods) {
    const original = (console[method] as unknown as (...args: any[]) => void).bind(console)
    console[method] = ((...args: any[]) => {
      const ts = new Date().toISOString()
      // Prefix as separate arg so objects keep their formatting.
      original(`[${ts}]`, ...args)
    }) as any
  }
}

export function register() {
  patchConsoleTimestampsOnce()
}

