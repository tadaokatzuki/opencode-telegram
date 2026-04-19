import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { TopicStore } from "../src/forum/topic-store"

describe("TopicStore", () => {
  let store: TopicStore
  const testDbPath = ":memory:"

  beforeEach(() => {
    store = new TopicStore(testDbPath)
  })

  afterEach(() => {
    store.close()
  })

  describe("createMapping", () => {
    it("should create a new mapping", () => {
      const result = store.createMapping(
        -1001234567890,
        1,
        "Test Topic",
        "session_abc123"
      )

      expect(result.success).toBe(true)
      expect(result.mapping).toBeDefined()
      expect(result.mapping?.sessionId).toBe("session_abc123")
      expect(result.mapping?.topicName).toBe("Test Topic")
    })

    it("should return existing mapping if already exists", () => {
      store.createMapping(-1001234567890, 1, "Test Topic", "session_abc123")
      const result = store.createMapping(-1001234567890, 1, "Test Topic", "session_xyz789")

      expect(result.success).toBe(true)
      expect(result.isExisting).toBe(true)
      expect(result.mapping?.sessionId).toBe("session_abc123")
    })

    it("should handle creator user id", () => {
      const result = store.createMapping(
        -1001234567890,
        2,
        "Test Topic",
        "session_abc123",
        { creatorUserId: 123456789 }
      )

      expect(result.success).toBe(true)
      expect(result.mapping?.creatorUserId).toBe(123456789)
    })

    it("should return error on failure", () => {
      const result = store.createMapping(
        -1001234567890,
        3,
        "Test",
        "session_invalid",
        { iconColor: 0xFF0000 }
      )

      expect(result.success).toBe(true)
    })
  })

  describe("getMapping", () => {
    it("should return null for non-existent mapping", () => {
      const result = store.getMapping(-1001234567890, 999)
      expect(result).toBeNull()
    })

    it("should return existing mapping", () => {
      store.createMapping(-1001234567890, 1, "Test", "session_abc")
      const result = store.getMapping(-1001234567890, 1)

      expect(result).toBeDefined()
      expect(result?.topicId).toBe(1)
    })
  })

  describe("getMappingBySession", () => {
    it("should find mapping by session ID", () => {
      store.createMapping(-1001234567890, 1, "Test", "session_abc")
      const result = store.getMappingBySession("session_abc")

      expect(result).toBeDefined()
      expect(result?.sessionId).toBe("session_abc")
    })

    it("should return null for non-existent session", () => {
      const result = store.getMappingBySession("non_existent")
      expect(result).toBeNull()
    })
  })

  describe("updateStatus", () => {
    it("should update topic status to closed", () => {
      store.createMapping(-1001234567890, 1, "Test", "session_abc")
      const result = store.updateStatus(-1001234567890, 1, "closed")

      expect(result).toBe(true)
      const mapping = store.getMapping(-1001234567890, 1)
      expect(mapping?.status).toBe("closed")
    })

    it("should update topic status to active", () => {
      store.createMapping(-1001234567890, 1, "Test", "session_abc")
      store.updateStatus(-1001234567890, 1, "closed")
      const result = store.updateStatus(-1001234567890, 1, "active")

      expect(result).toBe(true)
      const mapping = store.getMapping(-1001234567890, 1)
      expect(mapping?.status).toBe("active")
    })

    it("should return false for non-existent topic", () => {
      const result = store.updateStatus(-1001234567890, 999, "closed")
      expect(result).toBe(false)
    })
  })

  describe("toggleStreaming", () => {
    it("should enable streaming", () => {
      store.createMapping(-1001234567890, 1, "Test", "session_abc")
      const result = store.toggleStreaming(-1001234567890, 1, true)

      expect(result).toBe(true)
      const mapping = store.getMapping(-1001234567890, 1)
      expect(mapping?.streamingEnabled).toBe(true)
    })

    it("should disable streaming", () => {
      store.createMapping(-1001234567890, 1, "Test", "session_abc")
      store.toggleStreaming(-1001234567890, 1, true)
      const result = store.toggleStreaming(-1001234567890, 1, false)

      expect(result).toBe(true)
      const mapping = store.getMapping(-1001234567890, 1)
      expect(mapping?.streamingEnabled).toBe(false)
    })
  })

  describe("updateWorkDir", () => {
    it("should update working directory", () => {
      store.createMapping(-1001234567890, 1, "Test", "session_abc")
      const result = store.updateWorkDir(-1001234567890, 1, "/path/to/project")

      expect(result).toBe(true)
      const mapping = store.getMapping(-1001234567890, 1)
      expect(mapping?.workDir).toBe("/path/to/project")
    })
  })

  describe("updateName", () => {
    it("should update topic name", () => {
      store.createMapping(-1001234567890, 1, "Old Name", "session_abc")
      const result = store.updateName(-1001234567890, 1, "New Name")

      expect(result).toBe(true)
      const mapping = store.getMapping(-1001234567890, 1)
      expect(mapping?.topicName).toBe("New Name")
    })
  })

  describe("deleteMapping", () => {
    it("should delete mapping", () => {
      store.createMapping(-1001234567890, 1, "Test", "session_abc")
      const result = store.deleteMapping(-1001234567890, 1)

      expect(result).toBe(true)
      expect(store.getMapping(-1001234567890, 1)).toBeNull()
    })

    it("should return false for non-existent mapping", () => {
      const result = store.deleteMapping(-1001234567890, 999)
      expect(result).toBe(false)
    })
  })

  describe("getActiveMappings", () => {
    it("should return only active mappings", () => {
      store.createMapping(-1001234567890, 1, "Test1", "session_1")
      store.createMapping(-1001234567890, 2, "Test2", "session_2")
      store.updateStatus(-1001234567890, 1, "closed")

      const active = store.getActiveMappings(-1001234567890)
      expect(active).toHaveLength(1)
      expect(active[0]?.topicId).toBe(2)
    })
  })

  describe("queryMappings", () => {
    it("should filter by chat ID", () => {
      store.createMapping(-1001234567890, 1, "Test1", "session_1")
      store.createMapping(-1009876543210, 1, "Test2", "session_2")

      const results = store.queryMappings({ chatId: -1001234567890 })
      expect(results).toHaveLength(1)
    })

    it("should filter by status", () => {
      store.createMapping(-1001234567890, 1, "Test1", "session_1")
      store.createMapping(-1001234567890, 2, "Test2", "session_2")
      store.updateStatus(-1001234567890, 1, "closed")

      const results = store.queryMappings({ status: "closed" })
      expect(results).toHaveLength(1)
    })

    it("should apply limit", () => {
      for (let i = 1; i <= 10; i++) {
        store.createMapping(-1001234567890, i, `Test${i}`, `session_${i}`)
      }

      const results = store.queryMappings({ limit: 5 })
      expect(results).toHaveLength(5)
    })
  })

  describe("recordMessage", () => {
    it("should increment message count", () => {
      store.createMapping(-1001234567890, 1, "Test", "session_abc")
      store.recordMessage(-1001234567890, 1)

      const stats = store.getStats(-1001234567890, 1)
      expect(stats?.messageCount).toBe(1)
    })
  })

  describe("recordToolCall", () => {
    it("should increment tool call count", () => {
      store.createMapping(-1001234567890, 1, "Test", "session_abc")
      store.recordToolCall(-1001234567890, 1)

      const stats = store.getStats(-1001234567890, 1)
      expect(stats?.toolCalls).toBe(1)
    })
  })

  describe("recordError", () => {
    it("should increment error count", () => {
      store.createMapping(-1001234567890, 1, "Test", "session_abc")
      store.recordError(-1001234567890, 1)

      const stats = store.getStats(-1001234567890, 1)
      expect(stats?.errorCount).toBe(1)
    })
  })

  describe("getStats", () => {
    it("should return null for non-existent topic", () => {
      const stats = store.getStats(-1001234567890, 999)
      expect(stats).toBeNull()
    })

    it("should return stats for existing topic", () => {
      store.createMapping(-1001234567890, 1, "Test", "session_abc")
      store.recordMessage(-1001234567890, 1)
      store.recordToolCall(-1001234567890, 1)

      const stats = store.getStats(-1001234567890, 1)
      expect(stats).toEqual({
        messageCount: 1,
        lastMessageAt: expect.any(Number),
        toolCalls: 1,
        errorCount: 0,
      })
    })
  })

  describe("getEvents", () => {
    it("should return events for topic", () => {
      store.createMapping(-1001234567890, 1, "Test", "session_abc")

      const events = store.getEvents(-1001234567890, 1)
      expect(events.length).toBeGreaterThan(0)
      expect(events[0]?.eventType).toBe("created")
    })
  })

  describe("getAllSessionIds", () => {
    it("should return all active session IDs", () => {
      store.createMapping(-1001234567890, 1, "Test1", "session_1")
      store.createMapping(-1001234567890, 2, "Test2", "session_2")

      const sessionIds = store.getAllSessionIds()
      expect(sessionIds).toHaveLength(2)
      expect(sessionIds).toContain("session_1")
      expect(sessionIds).toContain("session_2")
    })

    it("should exclude closed sessions", () => {
      store.createMapping(-1001234567890, 1, "Test1", "session_1")
      store.updateStatus(-1001234567890, 1, "closed")

      const sessionIds = store.getAllSessionIds()
      expect(sessionIds).toHaveLength(0)
    })
  })
})