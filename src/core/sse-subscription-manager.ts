/**
 * SSE Subscription Manager
 * 
 * Manages SSE connections for OpenCode instances:
 * - Registers subscriptions with abort functions
 * - Tracks client↔instance relationships
 * - Provides cleanup on shutdown
 */

import type { OpenCodeClient } from "../opencode/client"

export interface SubscriptionEntry {
  abort: () => void
  client: OpenCodeClient
  sessionId: string
  topicId: number
  createdAt: number
}

export class SseSubscriptionManager {
  private subscriptions = new Map<string, SubscriptionEntry>()

  /**
   * Register a new SSE subscription
   */
  register(key: string, abort: () => void, client: OpenCodeClient, sessionId: string, topicId: number): void {
    this.cleanup(key)
    this.subscriptions.set(key, {
      abort,
      client,
      sessionId,
      topicId,
      createdAt: Date.now(),
    })
  }

  /**
   * Get a subscription by key
   */
  get(key: string): SubscriptionEntry | undefined {
    return this.subscriptions.get(key)
  }

  /**
   * Get subscription by session ID
   */
  getBySession(sessionId: string): SubscriptionEntry | undefined {
    for (const entry of this.subscriptions.values()) {
      if (entry.sessionId === sessionId) {
        return entry
      }
    }
    return undefined
  }

  /**
   * Get subscription by topic ID
   */
  getByTopic(topicId: number): SubscriptionEntry | undefined {
    for (const entry of this.subscriptions.values()) {
      if (entry.topicId === topicId) {
        return entry
      }
    }
    return undefined
  }

  /**
   * Cleanup a specific subscription
   */
  cleanup(key: string): void {
    const entry = this.subscriptions.get(key)
    if (entry) {
      try {
        entry.abort()
      } catch {
        // Ignore abort errors
      }
      try {
        entry.client.close()
      } catch {
        // Ignore close errors
      }
      this.subscriptions.delete(key)
    }
  }

  /**
   * Cleanup subscription by topic ID
   */
  cleanupByTopic(topicId: number): void {
    for (const [key, entry] of this.subscriptions) {
      if (entry.topicId === topicId) {
        this.cleanup(key)
        return
      }
    }
  }

  /**
   * Cleanup subscription by session ID
   */
  cleanupBySession(sessionId: string): void {
    for (const [key, entry] of this.subscriptions) {
      if (entry.sessionId === sessionId) {
        this.cleanup(key)
        return
      }
    }
  }

  /**
   * Get all subscription keys
   */
  getKeys(): string[] {
    return Array.from(this.subscriptions.keys())
  }

  /**
   * Get subscription count
   */
  getCount(): number {
    return this.subscriptions.size
  }

  /**
   * Cleanup all subscriptions (for shutdown)
   */
  cleanupAll(): void {
    for (const key of this.subscriptions.keys()) {
      this.cleanup(key)
    }
    this.subscriptions.clear()
  }

  /**
   * Get all subscriptions as array
   */
  getAll(): SubscriptionEntry[] {
    return Array.from(this.subscriptions.values())
  }
}

export function createSseSubscriptionManager(): SseSubscriptionManager {
  return new SseSubscriptionManager()
}