/**
 * Rate Limiter for Telegram API
 * 
 * Prevents hitting Telegram rate limits by tracking:
 * - Message count per time window
 * - Time-based rate limits (429 responses)
 * 
 * All state resets on cleanup.
 */

export interface RateLimiterConfig {
  windowMs: number
  maxMessages: number
}

export interface RateLimitResult {
  allowed: boolean
  waitTimeMs?: number
}

export class RateLimiter {
  private count = 0
  private windowStart = Date.now()
  private blockedUntil = 0
  private config: RateLimiterConfig

  constructor(config: RateLimiterConfig) {
    this.config = config
  }

  /**
   * Check if a message can be sent now
   */
  check(): RateLimitResult {
    const now = Date.now()

    if (now < this.blockedUntil) {
      return {
        allowed: false,
        waitTimeMs: this.blockedUntil - now,
      }
    }

    if (now - this.windowStart >= this.config.windowMs) {
      this.count = 0
      this.windowStart = now
    }

    if (this.count >= this.config.maxMessages) {
      const waitTimeMs = this.config.windowMs - (now - this.windowStart)
      return {
        allowed: false,
        waitTimeMs,
      }
    }

    return { allowed: true }
  }

  /**
   * Record a successful message send
   */
  recordSuccess(): void {
    this.count++
  }

  /**
   * Record a rate limit error (429)
   */
  recordRateLimitError(retryAfterSeconds: number): void {
    this.blockedUntil = Date.now() + (retryAfterSeconds * 1000) + 500
    this.count = 0
    this.windowStart = Date.now()
  }

  /**
   * Get current stats
   */
  getStats(): {
    remaining: number
    blocked: boolean
    blockedUntil?: number
  } {
    return {
      remaining: Math.max(0, this.config.maxMessages - this.count),
      blocked: Date.now() < this.blockedUntil,
      blockedUntil: this.blockedUntil > Date.now() ? this.blockedUntil : undefined,
    }
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.count = 0
    this.windowStart = Date.now()
    this.blockedUntil = 0
  }
}

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  return new RateLimiter(config)
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimiterConfig = {
  windowMs: 300000, // 5 minutes
  maxMessages: 60,   // 60 messages per window
}