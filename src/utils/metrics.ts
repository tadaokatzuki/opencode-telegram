/**
 * Prometheus metrics for monitoring
 */

interface MetricCounter {
  value: number
  labels: Record<string, string>
}

interface MetricHistogram {
  values: number[]
  labels: Record<string, string>
}

interface MetricGauge {
  value: number
  labels: Record<string, string>
}

class MetricsRegistry {
  private counters: Map<string, MetricCounter> = new Map()
  private histograms: Map<string, MetricHistogram> = new Map()
  private gauges: Map<string, MetricGauge> = new Map()
  private helpTexts: Map<string, string> = new Map()

  registerCounter(name: string, help: string, labelNames: string[]): void {
    this.helpTexts.set(name, help)
  }

  registerHistogram(name: string, help: string, labelNames: string[], buckets: number[]): void {
    this.helpTexts.set(name, help)
  }

  registerGauge(name: string, help: string, labelNames: string[]): void {
    this.helpTexts.set(name, help)
  }

  incCounter(name: string, labels: Record<string, string> = {}): void {
    const key = `${name}:${JSON.stringify(labels)}`
    const existing = this.counters.get(key)
    if (existing) {
      existing.value++
    } else {
      this.counters.set(key, { value: 1, labels })
    }
  }

  observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = `${name}:${JSON.stringify(labels)}`
    const existing = this.histograms.get(key)
    if (existing) {
      existing.values.push(value)
    } else {
      this.histograms.set(key, { values: [value], labels })
    }
  }

  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = `${name}:${JSON.stringify(labels)}`
    this.gauges.set(key, { value, labels })
  }

  getGauge(name: string, labels: Record<string, string> = {}): number {
    const key = `${name}:${JSON.stringify(labels)}`
    return this.gauges.get(key)?.value || 0
  }

  async getMetrics(): Promise<string> {
    const lines: string[] = []

    for (const [key, counter] of this.counters) {
      const name = key.split(":")[0]
      const labels = Object.entries(counter.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",")
      lines.push(`${name}${labels ? `{${labels}}` : ""} ${counter.value}`)
    }

    for (const [key, histogram] of this.histograms) {
      const name = key.split(":")[0]
      const labels = Object.entries(histogram.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",")
      const values = histogram.values
      const sum = values.reduce((a, b) => a + b, 0)
      const count = values.length
      const avg = count > 0 ? sum / count : 0
      lines.push(`${name}_sum${labels ? `{${labels}}` : ""} ${sum}`)
      lines.push(`${name}_count${labels ? `{${labels}}` : ""} ${count}`)
      lines.push(`${name}_avg${labels ? `{${labels}}` : ""} ${avg}`)
    }

    for (const [key, gauge] of this.gauges) {
      const name = key.split(":")[0]
      const labels = Object.entries(gauge.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",")
      lines.push(`${name}${labels ? `{${labels}}` : ""} ${gauge.value}`)
    }

    return lines.join("\n") + "\n"
  }
}

export const registry = new MetricsRegistry()

registry.registerCounter("opencode_messages_total", "Total messages processed", ["channel", "status"])
registry.registerCounter("opencode_errors_total", "Total errors", ["component", "type"])
registry.registerCounter("opencode_sessions_total", "Total sessions created", ["channel"])
registry.registerCounter("opencode_telegram_api_calls_total", "Telegram API calls", ["method", "status"])
registry.registerHistogram("opencode_request_duration_seconds", "Request duration in seconds", ["endpoint"], [0.1, 0.5, 1, 2, 5, 10])
registry.registerGauge("opencode_active_sessions", "Active sessions", ["channel"])
registry.registerGauge("opencode_uptime_seconds", "Uptime in seconds", [])
registry.registerGauge("opencode_memory_bytes", "Memory usage in bytes", ["type"])

let startTime = Date.now()

export function updateMetrics(): void {
  registry.setGauge("opencode_uptime_seconds", Math.floor((Date.now() - startTime) / 1000), {})
  
  if (typeof Bun !== "undefined" && Bun.memory) {
    const memory = Bun.memory()
    registry.setGauge("opencode_memory_bytes", Math.floor(memory.heapUsed), { type: "heap_used" })
    registry.setGauge("opencode_memory_bytes", Math.floor(memory.heapTotal), { type: "heap_total" })
  }
}

export function recordMessage(channel: "telegram" | "whatsapp", status: "success" | "error"): void {
  registry.incCounter("opencode_messages_total", { channel, status })
  updateMetrics()
}

export function recordError(component: string, type: string): void {
  registry.incCounter("opencode_errors_total", { component, type })
  updateMetrics()
}

export function recordSession(channel: "telegram" | "whatsapp"): void {
  registry.incCounter("opencode_sessions_total", { channel })
  updateMetrics()
}

export function recordTelegramApiCall(method: string, status: "success" | "error"): void {
  registry.incCounter("opencode_telegram_api_calls_total", { method, status })
  updateMetrics()
}

export function recordRequestDuration(endpoint: string, durationMs: number): void {
  registry.observeHistogram("opencode_request_duration_seconds", durationMs / 1000, { endpoint })
  updateMetrics()
}

export function setActiveSessions(channel: "telegram" | "whatsapp", count: number): void {
  registry.setGauge("opencode_active_sessions", count, { channel })
  updateMetrics()
}

export function getMetricsText(): string {
  updateMetrics()
  return registry.getMetrics()
}