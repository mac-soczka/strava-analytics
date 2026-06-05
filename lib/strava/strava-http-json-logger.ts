import fs from 'fs'
import path from 'path'
import { getLogger } from '@/lib/utils/logger'

const REDACT_KEYS = new Set(
  [
    'authorization',
    'access_token',
    'refresh_token',
    'client_secret',
    'password',
    'set-cookie',
  ].map((k) => k.toLowerCase())
)

function maxBytes(): number {
  const raw = process.env.STRAVA_HTTP_LOG_MAX_BYTES
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) && n > 0 ? n : 256 * 1024
}

let ndjsonPath: string | null = null

function ndjsonFile(): string {
  if (!ndjsonPath) {
    const dir = path.join(process.cwd(), 'logs')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    ndjsonPath = path.join(dir, `strava-http-${stamp}.jsonl`)
  }
  return ndjsonPath
}

function redactValue(key: string, value: unknown): unknown {
  if (REDACT_KEYS.has(key.toLowerCase())) return '[REDACTED]'
  return value
}

export function redactHeaders(h: Headers | Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  if (h instanceof Headers) {
    h.forEach((v, k) => {
      out[k] = String(redactValue(k, v) as string)
    })
    return out
  }
  for (const [k, v] of Object.entries(h)) {
    if (v === undefined) continue
    out[k] = String(redactValue(k, v) as string)
  }
  return out
}

function redactUrlSearchParamsBody(body: string): string {
  try {
    const params = new URLSearchParams(body)
    const redacted = new URLSearchParams()
    params.forEach((value, key) => {
      const k = key.toLowerCase()
      if (k === 'client_secret' || k === 'refresh_token' || k === 'access_token') {
        redacted.set(key, '[REDACTED]')
      } else {
        redacted.set(key, value)
      }
    })
    return redacted.toString()
  } catch {
    return '[unparsed body]'
  }
}

function parseOrString(raw: string, max: number): { value: unknown; truncated: boolean } {
  const truncatedFlag = raw.length > max
  const slice = truncatedFlag ? raw.slice(0, max) : raw
  const trimmed = slice.trim()
  if (!trimmed) return { value: '', truncated: truncatedFlag }
  try {
    return { value: JSON.parse(trimmed) as unknown, truncated: truncatedFlag }
  } catch {
    return { value: slice, truncated: truncatedFlag }
  }
}

export type StravaHttpLogInput = {
  strava_id?: number
  token_refresh?: boolean
  started_at_ms: number
  method: string
  url: string
  request_headers: Record<string, string>
  request_body: string | null
  response: Response
  response_body_text: string
  network_error?: string
}

function shallowTruncateForConsole(entry: Record<string, unknown>, max: number): Record<string, unknown> {
  const { response_body, request_body, ...rest } = entry as any
  const rb =
    typeof response_body === 'string'
      ? response_body.length > max
        ? `${response_body.slice(0, max)}...`
        : response_body
      : response_body
  const rq =
    typeof request_body === 'string'
      ? request_body.length > max
        ? `${request_body.slice(0, max)}...`
        : request_body
      : request_body
  return { ...rest, response_body: rb, request_body: rq }
}

/**
 * Append one NDJSON record for a Strava HTTP exchange (request + response).
 * Redacts secrets; truncates large bodies. Safe to call fire-and-forget.
 */
export async function logStravaHttpExchange(input: StravaHttpLogInput): Promise<void> {
  const max = maxBytes()
  const elapsed_ms = Date.now() - input.started_at_ms
  const resHeaders = redactHeaders(input.response.headers)

  let reqBodyOut: string | null = input.request_body
  if (reqBodyOut && input.token_refresh) {
    reqBodyOut = redactUrlSearchParamsBody(reqBodyOut)
  }

  const parsed = parseOrString(input.response_body_text, max)
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    strava_id: input.strava_id ?? null,
    token_refresh: input.token_refresh ?? false,
    method: input.method,
    url: input.url,
    elapsed_ms,
    request_headers: input.request_headers,
    request_body: reqBodyOut,
    response_status: input.network_error ? null : input.response.status,
    response_ok: input.network_error ? null : input.response.ok,
    response_headers: resHeaders,
    response_body: parsed.value,
    response_truncated: parsed.truncated,
    response_body_bytes: input.response_body_text.length,
    network_error: input.network_error ?? null,
  }

  const line = `${JSON.stringify(entry)}\n`
  try {
    fs.appendFileSync(ndjsonFile(), line, 'utf8')
  } catch {
    // ignore file errors
  }

  const logger = getLogger()
  const forConsole = shallowTruncateForConsole(entry, 2000)
  logger.log('Strava HTTP JSON', forConsole)
}

export function logStravaHttpNetworkFailure(input: {
  strava_id?: number
  token_refresh?: boolean
  started_at_ms: number
  method: string
  url: string
  init?: RequestInit
  message: string
}): void {
  const elapsed_ms = Date.now() - input.started_at_ms
  let request_headers: Record<string, string> = {}
  let request_body: string | null = null
  if (input.init?.headers instanceof Headers) {
    request_headers = redactHeaders(input.init.headers)
  } else if (input.init?.headers && typeof input.init.headers === 'object') {
    request_headers = redactHeaders(input.init.headers as Record<string, string>)
  }
  if (typeof input.init?.body === 'string') {
    request_body = input.token_refresh ? redactUrlSearchParamsBody(input.init.body) : input.init.body
  }

  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    strava_id: input.strava_id ?? null,
    token_refresh: input.token_refresh ?? false,
    method: input.method,
    url: input.url,
    elapsed_ms,
    request_headers,
    request_body,
    response_status: null,
    response_ok: null,
    response_headers: {},
    response_body: null,
    response_truncated: false,
    response_body_bytes: 0,
    network_error: input.message,
  }
  try {
    fs.appendFileSync(ndjsonFile(), `${JSON.stringify(entry)}\n`, 'utf8')
  } catch {
    // ignore
  }
  getLogger().log('Strava HTTP JSON', entry)
}

export async function logStravaHttpFromFetchParts(input: {
  strava_id?: number
  token_refresh?: boolean
  started_at_ms: number
  method: string
  url: string
  init: RequestInit
  response: Response
}): Promise<void> {
  const method = input.method.toUpperCase()
  const hdrs =
    input.init.headers instanceof Headers
      ? redactHeaders(input.init.headers)
      : typeof input.init.headers === 'object' && input.init.headers
        ? redactHeaders(input.init.headers as Record<string, string>)
        : {}

  let requestBody: string | null = null
  if (typeof input.init.body === 'string') {
    requestBody = input.init.body
  }

  let responseText = ''
  try {
    responseText = await input.response.clone().text()
  } catch {
    responseText = ''
  }

  await logStravaHttpExchange({
    strava_id: input.strava_id,
    token_refresh: input.token_refresh,
    started_at_ms: input.started_at_ms,
    method,
    url: input.url,
    request_headers: hdrs,
    request_body: requestBody,
    response: input.response,
    response_body_text: responseText,
  })
}
