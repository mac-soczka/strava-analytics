const GLOBAL_KEY = '__stravaHeatmapStdoutTimestampPatch__'

// eslint-disable-next-line no-unused-vars
type WriteFn = (chunk: any, encoding?: any, cb?: any) => boolean

function tsPrefix() {
  return `[${new Date().toISOString()}]`
}

function isAlreadyPrefixed(line: string) {
  return /^\[\d{4}-\d{2}-\d{2}T/.test(line)
}

function prefixMultiline(s: string) {
  return s
    .split('\n')
    .map((line) => (isAlreadyPrefixed(line) ? line : `${tsPrefix()} ${line}`))
    .join('\n')
}

/**
 * Patch stdout/stderr so each emitted line starts with an ISO timestamp.
 * This catches framework logs too (e.g. Next request logs), not just console.*.
 * Server-only: imported from `app/layout.tsx` for dev/prod Node logs.
 */
export function installConsoleTimestampPrefix() {
  const g = globalThis as unknown as Record<string, unknown>
  if (g[GLOBAL_KEY]) return

  const origStdoutWrite = process.stdout.write.bind(process.stdout) as WriteFn
  const origStderrWrite = process.stderr.write.bind(process.stderr) as WriteFn

  g[GLOBAL_KEY] = { origStdoutWrite, origStderrWrite }

  const makeWrite = (orig: WriteFn) => {
    let carry = ''
    return (chunk: any, encoding?: any, cb?: any) => {
      const text = typeof chunk === 'string' ? chunk : chunk?.toString?.(encoding) ?? String(chunk)
      const combined = carry + text
      const parts = combined.split('\n')
      carry = parts.pop() ?? ''

      const out = parts
        .map((line) => (line.length > 0 ? prefixMultiline(line) : `${tsPrefix()}`))
        .join('\n') + '\n'
      const ok = orig(out, encoding, cb)
      return ok
    }
  }

  process.stdout.write = makeWrite(origStdoutWrite) as any
  process.stderr.write = makeWrite(origStderrWrite) as any
}

