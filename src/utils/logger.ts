/**
 * Logging utilities with timestamps and structured logging
 */

const TIMESTAMP_FORMAT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

export function timestamp(): string {
  return TIMESTAMP_FORMAT.format(new Date())
}

export function formatLog(component: string, message: string): string {
  return `[${timestamp()}] [${component}] ${message}`
}

type BotApi = {
  sendMessage: (chatId: number, text: string, options?: object) => Promise<any>
}

let botApi: BotApi | null = null
let alertChatId: number | null = null

export function setupTelegramAlerts(bot: BotApi, chatId: number): void {
  botApi = bot
  alertChatId = chatId
  console.log("[Logger] Telegram alerts enabled")
}

export async function sendTelegramAlert(title: string, message: string, isError: boolean = false): Promise<void> {
  if (!botApi || !alertChatId) return
  
  const icon = isError ? "❌" : "⚠️"
  const escapedMessage = message.replace(/[*_`\[\]]/g, "\\$&").slice(0, 300)
  
  try {
    await botApi.sendMessage(
      alertChatId,
      `${icon} *${title}*\n\n${escapedMessage}`,
      { parse_mode: "Markdown" }
    )
  } catch (e) {
    console.error("[Logger] Failed to send Telegram alert:", e)
  }
}

export const Logger = {
  log(component: string, message: string): void {
    console.log(formatLog(component, message))
  },
  
  error(component: string, message: string, error?: unknown): void {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(formatLog(component, `ERROR: ${errorMsg}`))
    
    // Send Telegram alert for errors
    sendTelegramAlert("Error", `${component}: ${errorMsg}`, true).catch(() => {})
  },
  
  warn(component: string, message: string): void {
    console.warn(formatLog(component, `WARN: ${message}`))
  },
  
  info(component: string, message: string): void {
    console.log(formatLog(component, message))
  },
  
  debug(component: string, message: string): void {
    if (process.env.DEBUG) {
      console.log(formatLog(component, `DEBUG: ${message}`))
    }
  },
}

/**
 * Metrics collector for monitoring
 */
export interface Metrics {
  uptime: number
  messagesProcessed: number
  errors: number
  sessionsCreated: number
  sessionsAborted: number
  restarts: number
  lastError?: string
  lastErrorAt?: Date
}

class MetricsCollector {
  private metrics: Metrics = {
    uptime: Date.now(),
    messagesProcessed: 0,
    errors: 0,
    sessionsCreated: 0,
    sessionsAborted: 0,
    restarts: 0,
  }

  incrementMessages(): void {
    this.metrics.messagesProcessed++
  }

  incrementErrors(error?: string): void {
    this.metrics.errors++
    this.metrics.lastError = error
    this.metrics.lastErrorAt = new Date()
  }

  incrementSessionsCreated(): void {
    this.metrics.sessionsCreated++
  }

  incrementSessionsAborted(): void {
    this.metrics.sessionsAborted++
  }

  incrementRestarts(): void {
    this.metrics.restarts++
  }

  getMetrics(): Metrics & { uptimeSeconds: number } {
    return {
      ...this.metrics,
      uptimeSeconds: Math.floor((Date.now() - this.metrics.uptime) / 1000),
    }
  }

  reset(): void {
    this.metrics = {
      uptime: Date.now(),
      messagesProcessed: 0,
      errors: 0,
      sessionsCreated: 0,
      sessionsAborted: 0,
      restarts: 0,
    }
  }
}

export const metrics = new MetricsCollector()

export function formatMetrics(m: Metrics & { uptimeSeconds: number }): string {
  const hours = Math.floor(m.uptimeSeconds / 3600)
  const minutes = Math.floor((m.uptimeSeconds % 3600) / 60)
  const seconds = m.uptimeSeconds % 60
  
  const uptime = hours > 0 
    ? `${hours}h ${minutes}m`
    : minutes > 0
      ? `${minutes}m ${seconds}s`
      : `${seconds}s`

  const lines = [
    `📊 *Bot Metrics*`,
    ``,
    `⏱️ Uptime: ${uptime}`,
    `💬 Messages: ${m.messagesProcessed}`,
    `✅ Sessions: ${m.sessionsCreated}`,
    `❌ Errors: ${m.errors}`,
    `🔄 Restarts: ${m.restarts}`,
  ]

  if (m.lastError) {
    const timeAgo = m.lastErrorAt 
      ? Math.floor((Date.now() - m.lastErrorAt.getTime()) / 1000)
      : 0
    const timeAgoStr = timeAgo < 60 
      ? `${timeAgo}s ago`
      : `${Math.floor(timeAgo / 60)}m ago`
    lines.push(``, `Last error (${timeAgoStr}): ${m.lastError.slice(0, 50)}`)
  }

  return lines.join("\n")
}
