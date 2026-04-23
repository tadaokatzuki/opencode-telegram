/**
 * Integration Layer Configuration
 * 
 * Centralizes all configuration options for the integration layer.
 */

import type { AppConfig } from "../config"
import type { TopicStore } from "../forum/topic-store"

export interface IntegrationConfig {
  appConfig: AppConfig
  topicStore: TopicStore
  antiLoop: {
    maxTools: number
    maxThinking: number
    hardTimeoutMs: number
    warningTimeoutMs: number
  }
  rateLimit: {
    windowMs: number
    maxMessages: number
  }
  streamHandler: {
    updateIntervalMs: number
    showToolNames: boolean
    deleteProgressOnComplete: boolean
  }
}

export function createIntegrationConfig(appConfig: AppConfig, topicStore: TopicStore): IntegrationConfig {
  return {
    appConfig,
    topicStore,
    antiLoop: {
      maxTools: 10,
      maxThinking: 8,
      hardTimeoutMs: 600000,  // 10 minutes
      warningTimeoutMs: 180000, // 3 minutes
    },
    rateLimit: {
      windowMs: 300000, // 5 minutes
      maxMessages: 60,
    },
    streamHandler: {
      updateIntervalMs: 2000,
      showToolNames: true,
      deleteProgressOnComplete: true,
    },
  }
}