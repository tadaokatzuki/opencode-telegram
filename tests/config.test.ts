import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  loadConfig,
  validateConfig,
  sanitizeError,
  toManagerConfig,
  toTopicManagerConfig,
} from "../src/config"

describe("Config", () => {
  describe("validateConfig", () => {
    it("should return error when TELEGRAM_BOT_TOKEN is missing", () => {
      const config = loadConfig()
      config.telegram.botToken = ""
      const result = validateConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("TELEGRAM_BOT_TOKEN is required")
    })

    it("should return error when TELEGRAM_CHAT_ID is missing", () => {
      const config = loadConfig()
      config.telegram.chatId = 0
      const result = validateConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("TELEGRAM_CHAT_ID is required")
    })

    it("should return error when maxInstances < 1", () => {
      const config = loadConfig()
      config.opencode.maxInstances = 0
      const result = validateConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("OPENCODE_MAX_INSTANCES must be at least 1")
    })

    it("should return error when portPoolSize < maxInstances", () => {
      const config = loadConfig()
      config.opencode.portPoolSize = 2
      config.opencode.maxInstances = 5
      const result = validateConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("OPENCODE_PORT_POOL_SIZE must be >= OPENCODE_MAX_INSTANCES")
    })

    it("should return valid when config is correct", () => {
      const config = loadConfig()
      config.telegram.botToken = "test_token"
      config.telegram.chatId = -1001234567890
      const result = validateConfig(config)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe("sanitizeError", () => {
    it("should return default message for null/undefined error", () => {
      expect(sanitizeError(null)).toBe("An unknown error occurred")
      expect(sanitizeError(undefined)).toBe("An unknown error occurred")
    })

    it("should return default message for non-object error", () => {
      expect(sanitizeError(123)).toBe("An internal error occurred")
      expect(sanitizeError([])).toBe("An internal error occurred")
    })

    it("should sanitize Error objects", () => {
      const error = new Error("/home/user/project/src/test.ts:123:45 error")
      const result = sanitizeError(error)
      expect(result).not.toContain("/home/user")
      expect(result).toContain("[path]")
    })

    it("should sanitize file paths", () => {
      const error = new Error("Error in /home/user/project/node_modules/package/index.js")
      const result = sanitizeError(error)
      expect(result).not.toContain("/home/user")
    })

    it("should sanitize localhost:port", () => {
      const error = new Error("Connection to localhost:4100 failed")
      const result = sanitizeError(error)
      expect(result).toContain("[host]")
    })

    it("should sanitize IPs", () => {
      const error = new Error("Connection from 192.168.1.100")
      const result = sanitizeError(error)
      expect(result).toContain("[ip]")
    })

    it("should sanitize database paths", () => {
      const error = new Error("Cannot open database topics.db")
      const result = sanitizeError(error)
      expect(result).toContain("[db]")
    })

    it("should truncate long messages", () => {
      const longMessage = "a".repeat(500)
      const error = new Error(longMessage)
      const result = sanitizeError(error)
      expect(result.length).toBeLessThanOrEqual(200)
    })

    it("should remove stack traces", () => {
      const error = new Error("Error\nat Function.name (file.ts:123)\nat Other (other.ts:456)")
      const result = sanitizeError(error)
      expect(result).not.toContain("at ")
    })
  })

  describe("toManagerConfig", () => {
    it("should map AppConfig to ManagerConfig", () => {
      const appConfig = loadConfig()
      appConfig.opencode.maxInstances = 5
      appConfig.opencode.portStart = 4100
      appConfig.opencode.portPoolSize = 10

      const managerConfig = toManagerConfig(appConfig)

      expect(managerConfig.maxInstances).toBe(5)
      expect(managerConfig.portPool).toEqual({
        startPort: 4100,
        poolSize: 10,
      })
    })
  })

  describe("toTopicManagerConfig", () => {
    it("should map AppConfig to TopicManagerConfig", () => {
      const appConfig = loadConfig()
      appConfig.storage.topicDbPath = "./test.db"
      appConfig.telegram.handleGeneralTopic = false

      const topicConfig = toTopicManagerConfig(appConfig)

      expect(topicConfig.databasePath).toBe("./test.db")
      expect(topicConfig.handleGeneralTopic).toBe(false)
    })
  })
})