import { describe, it, expect, vi, beforeEach } from "vitest"
import { createSseSubscriptionManager, SseSubscriptionManager } from "../src/core/sse-subscription-manager"
import type { OpenCodeClient } from "../src/opencode/client"

describe("SseSubscriptionManager", () => {
  let manager: SseSubscriptionManager
  let mockAbort: ReturnType<typeof vi.fn>
  let mockClient: Partial<OpenCodeClient>

  beforeEach(() => {
    manager = createSseSubscriptionManager()
    mockAbort = vi.fn()
    mockClient = {
      close: vi.fn(),
    }
  })

  describe("register", () => {
    it("should register a new subscription", () => {
      manager.register("key1", mockAbort, mockClient as OpenCodeClient, "session1", 123)

      expect(manager.getCount()).toBe(1)
      expect(manager.get("key1")).toBeDefined()
    })

    it("should cleanup existing subscription when re-registering", () => {
      const abort2 = vi.fn()
      manager.register("key1", mockAbort, mockClient as OpenCodeClient, "session1", 123)
      manager.register("key1", abort2, mockClient as OpenCodeClient, "session2", 456)

      expect(mockAbort).toHaveBeenCalled()
      expect(manager.getCount()).toBe(1)
    })
  })

  describe("getBySession", () => {
    it("should find subscription by session ID", () => {
      manager.register("key1", mockAbort, mockClient as OpenCodeClient, "session1", 123)
      manager.register("key2", mockAbort, mockClient as OpenCodeClient, "session2", 456)

      const found = manager.getBySession("session1")
      expect(found?.sessionId).toBe("session1")
    })
  })

  describe("getByTopic", () => {
    it("should find subscription by topic ID", () => {
      manager.register("key1", mockAbort, mockClient as OpenCodeClient, "session1", 123)

      const found = manager.getByTopic(123)
      expect(found?.topicId).toBe(123)
    })
  })

  describe("cleanup", () => {
    it("should abort and close on cleanup", () => {
      manager.register("key1", mockAbort, mockClient as OpenCodeClient, "session1", 123)
      manager.cleanup("key1")

      expect(mockAbort).toHaveBeenCalled()
      expect(mockClient.close).toHaveBeenCalled()
      expect(manager.getCount()).toBe(0)
    })

    it("should handle cleanup of non-existent key", () => {
      expect(() => manager.cleanup("nonexistent")).not.toThrow()
    })
  })

  describe("cleanupByTopic", () => {
    it("should cleanup subscription by topic", () => {
      manager.register("key1", mockAbort, mockClient as OpenCodeClient, "session1", 123)
      manager.cleanupByTopic(123)

      expect(mockAbort).toHaveBeenCalled()
      expect(manager.getCount()).toBe(0)
    })
  })

  describe("cleanupBySession", () => {
    it("should cleanup subscription by session", () => {
      manager.register("key1", mockAbort, mockClient as OpenCodeClient, "session1", 123)
      manager.cleanupBySession("session1")

      expect(mockAbort).toHaveBeenCalled()
      expect(manager.getCount()).toBe(0)
    })
  })

  describe("cleanupAll", () => {
    it("should cleanup all subscriptions", () => {
      manager.register("key1", mockAbort, mockClient as OpenCodeClient, "session1", 123)
      manager.register("key2", mockAbort, mockClient as OpenCodeClient, "session2", 456)
      manager.register("key3", mockAbort, mockClient as OpenCodeClient, "session3", 789)

      expect(manager.getCount()).toBe(3)
      manager.cleanupAll()

      expect(manager.getCount()).toBe(0)
      expect(mockAbort).toHaveBeenCalledTimes(3)
    })
  })

  describe("getAll", () => {
    it("should return all subscriptions as array", () => {
      manager.register("key1", mockAbort, mockClient as OpenCodeClient, "session1", 123)
      manager.register("key2", mockAbort, mockClient as OpenCodeClient, "session2", 456)

      const all = manager.getAll()
      expect(all).toHaveLength(2)
    })
  })
})