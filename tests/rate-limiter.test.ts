import { describe, it, expect, beforeEach } from "vitest"
import { createRateLimiter, RateLimiter, DEFAULT_RATE_LIMIT_CONFIG } from "../src/core/rate-limiter"

describe("RateLimiter", () => {
  describe("basic functionality", () => {
    it("should allow messages within limit", () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxMessages: 5,
      })

      for (let i = 0; i < 5; i++) {
        const result = limiter.check()
        expect(result.allowed).toBe(true)
        limiter.recordSuccess()
      }
    })

    it("should block messages when limit reached", () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxMessages: 3,
      })

      limiter.recordSuccess()
      limiter.recordSuccess()
      limiter.recordSuccess()

      const result = limiter.check()
      expect(result.allowed).toBe(false)
      expect(result.waitTimeMs).toBeGreaterThan(0)
    })

    it("should use default config", () => {
      const limiter = createRateLimiter(DEFAULT_RATE_LIMIT_CONFIG)
      expect(limiter.getStats().remaining).toBe(60)
    })
  })

  describe("rate limit errors", () => {
    it("should record rate limit error", () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxMessages: 5,
      })

      limiter.recordRateLimitError(3)

      const result = limiter.check()
      expect(result.allowed).toBe(false)
    })

    it("should reset count after rate limit", () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxMessages: 5,
      })

      limiter.recordSuccess()
      limiter.recordSuccess()
      limiter.recordRateLimitError(1)

      expect(limiter.getStats().remaining).toBe(5)
    })
  })

  describe("window reset", () => {
    it("should reset count when window expires", async () => {
      const limiter = createRateLimiter({
        windowMs: 100,
        maxMessages: 3,
      })

      limiter.recordSuccess()
      limiter.recordSuccess()
      limiter.recordSuccess()

      expect(limiter.check().allowed).toBe(false)

      await new Promise((r) => setTimeout(r, 150))

      expect(limiter.check().allowed).toBe(true)
      expect(limiter.getStats().remaining).toBe(3)
    })
  })

  describe("reset", () => {
    it("should reset all state", () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxMessages: 5,
      })

      limiter.recordSuccess()
      limiter.recordSuccess()
      limiter.recordRateLimitError(5)

      limiter.reset()

      expect(limiter.check().allowed).toBe(true)
      expect(limiter.getStats().remaining).toBe(5)
      expect(limiter.getStats().blocked).toBe(false)
    })
  })
})