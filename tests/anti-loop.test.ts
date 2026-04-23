import { describe, it, expect, beforeEach } from "vitest"
import { createAntiLoopManager, AntiLoopManager } from "../src/core/anti-loop-manager"
import type { SSEEvent } from "../src/opencode/types"

describe("AntiLoopManager", () => {
  let manager: AntiLoopManager
  let sendToTopicCalled: { chatId: number; topicId: number; text: string } | null = null

  const mockConfig = {
    maxTools: 10,
    maxThinking: 8,
    hardTimeoutMs: 600000,
    warningTimeoutMs: 180000,
    chatId: -1001234567890,
    debugTopicId: 1,
    bot: {} as any,
    streamHandler: {} as any,
    sendToTopic: async (chatId: number, topicId: number, text: string) => {
      sendToTopicCalled = { chatId, topicId, text }
    },
  }

  beforeEach(() => {
    manager = createAntiLoopManager(mockConfig)
    sendToTopicCalled = null
  })

  it("should track tool execution counts", () => {
    const sessionId = "test-session-1"
    const topicId = 123

    manager.startTimers(sessionId, topicId)

    for (let i = 0; i < 5; i++) {
      const event: SSEEvent = {
        type: "tool.execute",
        properties: { tool: "Read", args: {} },
      }
      const result = manager.handleEvent(sessionId, event, topicId)
      expect(result.blocked).toBe(false)
    }

    const stats = manager.getStats()
    expect(stats.activeSessions).toBe(1)
  })

  it("should block when max tools exceeded", () => {
    const sessionId = "test-session-2"
    const topicId = 456

    manager.startTimers(sessionId, topicId)

    for (let i = 0; i < 10; i++) {
      manager.handleEvent(sessionId, {
        type: "tool.execute",
        properties: { tool: "Read", args: {} },
      }, topicId)
    }

    const result = manager.handleEvent(sessionId, {
      type: "tool.execute",
      properties: { tool: "Write", args: {} },
    }, topicId)

    expect(result.blocked).toBe(true)
    expect(result.message).toContain("Too many tools")
  })

  it("should reset tool count on session.updated with status=running", () => {
    const sessionId = "test-session-3"
    const topicId = 789

    manager.startTimers(sessionId, topicId)

    // Add some tool calls
    for (let i = 0; i < 5; i++) {
      manager.handleEvent(sessionId, {
        type: "tool.execute",
        properties: { tool: "Read", args: {} },
      }, topicId)
    }

    // Simulate new session
    manager.handleEvent(sessionId, {
      type: "session.updated",
      properties: { status: "running" },
    }, topicId)

    // Should be able to add more tools
    const result = manager.handleEvent(sessionId, {
      type: "tool.execute",
      properties: { tool: "Read", args: {} },
    }, topicId)

    expect(result.blocked).toBe(false)
  })

  it("should cleanup session properly", () => {
    const sessionId = "test-session-4"
    const topicId = 111

    manager.startTimers(sessionId, topicId)
    expect(manager.getStats().activeSessions).toBe(1)

    manager.cleanupSession(sessionId)
    expect(manager.getStats().activeSessions).toBe(0)
  })

  it("should cleanup all sessions", () => {
    manager.startTimers("session-1", 1)
    manager.startTimers("session-2", 2)
    manager.startTimers("session-3", 3)

    expect(manager.getStats().activeSessions).toBe(3)

    manager.cleanupAll()

    expect(manager.getStats().activeSessions).toBe(0)
    expect(manager.getStats().totalToolsTracked).toBe(0)
  })
})