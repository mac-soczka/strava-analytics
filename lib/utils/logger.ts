import fs from 'fs'
import path from 'path'

class Logger {
  private logFile: string
  private sessionId: string
  private logsDir: string

  constructor() {
    // Create logs directory if it doesn't exist
    this.logsDir = path.join(process.cwd(), 'logs')
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true })
    }

    // Create session ID from timestamp
    this.sessionId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    this.logFile = path.join(this.logsDir, `sync-${this.sessionId}.log`)

    // Write session header
    this.writeToFile(`\n${'='.repeat(80)}\n`)
    this.writeToFile(`SESSION START: ${new Date().toISOString()}\n`)
    this.writeToFile(`${'='.repeat(80)}\n\n`)
  }

  private writeToFile(message: string) {
    try {
      fs.appendFileSync(this.logFile, message)
    } catch (error) {
      const ts = new Date().toISOString()
      console.error(`[${ts}] [ERROR] Failed to write to log file:`, error)
    }
  }

  private prefixLines(prefix: string, content: string): string {
    return content
      .split('\n')
      .map((line) => `${prefix}${line}`)
      .join('\n')
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${level}] `

    let body = message
    if (data !== undefined) {
      if (typeof data === 'object') {
        const json = JSON.stringify(data, null, 2)
        body += `\n${json}`
      } else {
        body += ` ${String(data)}`
      }
    }

    return this.prefixLines(prefix, body) + '\n'
  }

  log(message: string, data?: any) {
    const formatted = this.formatMessage('INFO', message, data)
    console.log(formatted.trimEnd())
    this.writeToFile(formatted)
  }

  warn(message: string, data?: any) {
    const formatted = this.formatMessage('WARN', message, data)
    console.warn(formatted.trimEnd())
    this.writeToFile(formatted)
  }

  error(message: string, data?: any) {
    const formatted = this.formatMessage('ERROR', message, data)
    console.error(formatted.trimEnd())
    this.writeToFile(formatted)
  }

  /**
   * Log rate limit information with special formatting
   */
  rateLimit(usage: { requests15min: number; limit15min: number; requestsDay: number; limitDay: number }) {
    const message = `
┌─────────────────────────────────────────────────────────────┐
│ RATE LIMITS (from Strava API)                              │
├─────────────────────────────────────────────────────────────┤
│ 15-minute window: ${String(usage.requests15min).padStart(3)} / ${String(usage.limit15min).padEnd(3)} (${String(usage.limit15min - usage.requests15min).padStart(3)} remaining) │
│ Daily window:     ${String(usage.requestsDay).padStart(3)} / ${String(usage.limitDay).padEnd(4)} (${String(usage.limitDay - usage.requestsDay).padStart(4)} remaining) │
└─────────────────────────────────────────────────────────────┘
`
    const formatted = this.formatMessage('RATE-LIMIT', message.trim())
    console.log(formatted.trimEnd())
    this.writeToFile(formatted)
  }

  /**
   * Log session end
   */
  sessionEnd() {
    const message = `\n${'='.repeat(80)}\nSESSION END: ${new Date().toISOString()}\n${'='.repeat(80)}\n`
    this.writeToFile(message)
  }

  /**
   * Get current log file path
   */
  getLogFile(): string {
    return this.logFile
  }
}

// Singleton instance
let loggerInstance: Logger | null = null

export function getLogger(): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger()
  }
  return loggerInstance
}

export function resetLogger() {
  if (loggerInstance) {
    loggerInstance.sessionEnd()
  }
  loggerInstance = null
}
