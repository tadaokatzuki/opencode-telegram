/**
 * Anti-Loop Protection Manager
 * 
 * Prevents infinite loops and runaway sessions by enforcing:
 * - Max tool calls per session
 * - Hard timeout per session
 * - Warning timeout before hard timeout
 * 
 * All state is automatically cleaned up on shutdown.
 */

import type { SSEEvent } from "../opencode/types"
import type { Bot } from "grammy"
import type { StreamHandler } from "../opencode/stream-handler"

export interface AntiLoopConfig {
  maxTools: number
  maxThinking: number
  hardTimeoutMs: number
  warningTimeoutMs: number
  chatId: number
  debugTopicId?: number
  bot: Bot
  streamHandler: StreamHandler
  sendToTopic: (chatId: number, topicId: number, text: string) => Promise<void>
}

interface SessionState {
  toolCount: number
  thinkingCount: number
  hardTimer: ReturnType<typeof setTimeout> | null
  warningTimer: ReturnType<typeof setTimeout> | null
  createdAt: number
}

export class AntiLoopManager {
  private sessions = new Map<string, SessionState>()
  private config: AntiLoopConfig

  constructor(config: AntiLoopConfig) {
    this.config = config
  }

  /**
   * Handle an SSE event - tracks state and checks limits
   */
  handleEvent(
    sessionId: string,
    event: SSEEvent,
    topicId: number
  ): { blocked: boolean; message?: string } {
    const state = this.getOrCreateState(sessionId)

    switch (event.type) {
      case "tool.execute": {
        state.toolCount++
        if (state.toolCount > this.config.maxTools) {
          this.cleanupSession(sessionId)
          return {
            blocked: true,
            message: `Too many tools (limit: ${this.config.maxTools}). Try something more specific.`,
          }
        }
        break
      }

      case "session.updated": {
        const props = event.properties as Record<string, unknown>
        if (props.status === "running") {
          state.thinkingCount++
          state.toolCount = 0
        }
        break
      }
    }

    return { blocked: false }
  }

  /**
   * Start timers for a new session
   */
  startTimers(sessionId: string, topicId: number): void {
    const state = this.getOrCreateState(sessionId)
    const chatId = this.config.chatId

    if (state.warningTimer) {
      clearTimeout(state.warningTimer)
    }
    if (state.hardTimer) {
      clearTimeout(state.hardTimer)
    }

    state.warningTimer = setTimeout(async () => {
      await this.config.sendToTopic(chatId, topicId, "Still working... please be patient.")
    }, this.config.warningTimeoutMs)

    state.hardTimer = setTimeout(async () => {
      await this.config.sendToTopic(
        chatId,
        topicId,
        "Maximum time exceeded (10 min). Try something more specific."
      )
      this.cleanupSession(sessionId)
    }, this.config.hardTimeoutMs)
  }

  /**
   * Stop timers and cleanup for a session
   */
  cleanupSession(sessionId: string): void {
    const state = this.sessions.get(sessionId)
    if (!state) return

    if (state.warningTimer) {
      clearTimeout(state.warningTimer)
      state.warningTimer = null
    }
    if (state.hardTimer) {
      clearTimeout(state.hardTimer)
      state.hardTimer = null
    }

    this.sessions.delete(sessionId)
  }

  /**
   * Cleanup all sessions (for shutdown)
   */
  cleanupAll(): void {
    for (const [sessionId] of this.sessions) {
      this.cleanupSession(sessionId)
    }
    this.sessions.clear()
  }

  /**
   * Get session stats
   */
  getStats(): { activeSessions: number; totalToolsTracked: number } {
    let totalTools = 0
    for (const state of this.sessions.values()) {
      totalTools += state.toolCount
    }
    return {
      activeSessions: this.sessions.size,
      totalToolsTracked: totalTools,
    }
  }

  private getOrCreateState(sessionId: string): SessionState {
    let state = this.sessions.get(sessionId)
    if (!state) {
      state = {
        toolCount: 0,
        thinkingCount: 0,
        hardTimer: null,
        warningTimer: null,
        createdAt: Date.now(),
      }
      this.sessions.set(sessionId, state)
    }
    return state
  }
}

export function createAntiLoopManager(config: AntiLoopConfig): AntiLoopManager {
  return new AntiLoopManager(config)
}