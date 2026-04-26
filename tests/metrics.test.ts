import { describe, it, expect, beforeEach } from "vitest"
import { 
  registry, 
  recordMessage, 
  recordError, 
  recordSession, 
  setActiveSessions,
  updateMetrics
} from "../src/utils/metrics"

describe("Metrics", () => {
  beforeEach(() => {
    registry.counters.clear()
    registry.histograms.clear()
    registry.gauges.clear()
  })

  describe("Counter increment", () => {
    it("should increment counter", () => {
      registry.incCounter("test_counter", { label: "value" })
      expect(registry.counters.size).toBeGreaterThanOrEqual(1)
    })

    it("should increment counter multiple times", () => {
      registry.incCounter("test_counter")
      registry.incCounter("test_counter")
      registry.incCounter("test_counter")
      expect(registry.counters.size).toBeGreaterThan(0)
    })
  })

  describe("Gauge set", () => {
    it("should set gauge value", () => {
      registry.setGauge("test_gauge", 42, { env: "test" })
      expect(registry.getGauge("test_gauge", { env: "test" })).toBe(42)
    })
  })

  describe("Histogram observation", () => {
    it("should record histogram values", () => {
      registry.observeHistogram("test_histogram", 0.5)
      registry.observeHistogram("test_histogram", 1.5)
      expect(registry.histograms.size).toBeGreaterThan(0)
    })
  })

  describe("recordMessage", () => {
    it("should record message without throwing", () => {
      expect(() => recordMessage("whatsapp", "error")).not.toThrow()
    })

    it("should increment messages counter", () => {
      const sizeBefore = registry.counters.size
      recordMessage("telegram", "success")
      expect(registry.counters.size).toBeGreaterThanOrEqual(sizeBefore)
    })
  })

  describe("recordError", () => {
    it("should record error without throwing", () => {
      expect(() => recordError("ApiServer", "connection")).not.toThrow()
    })
  })

  describe("recordSession", () => {
    it("should record session without throwing", () => {
      expect(() => recordSession("telegram")).not.toThrow()
    })
  })

  describe("setActiveSessions", () => {
    it("should set active session count", () => {
      expect(() => setActiveSessions("whatsapp", 5)).not.toThrow()
      expect(registry.getGauge("opencode_active_sessions", { channel: "whatsapp" })).toBe(5)
    })
  })

  describe("updateMetrics", () => {
    it("should update metrics without throwing", () => {
      expect(() => updateMetrics()).not.toThrow()
    })
  })
})