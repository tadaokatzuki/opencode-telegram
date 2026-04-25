import { describe, it, expect } from "vitest"
import { ApiServer } from "../src/api-server"

describe("ApiServer Integration", () => {
  describe("topicIdIndex", () => {
    it("should track topicId in secondary index", () => {
      const server = new ApiServer({
        port: 4200,
        apiKey: "test_key",
        corsOrigins: "*",
        config: {} as any,
        topicStore: {
          createMapping: () => {},
          updateWorkDir: () => {},
          toggleStreaming: () => {},
          getMapping: () => undefined,
        } as any,
        streamHandler: {
          registerSession: () => {},
          unregisterSession: () => {},
        } as any,
        bot: {
          api: {
            createForumTopic: () => Promise.resolve({ message_thread_id: 100 }),
          },
        } as any,
      })

      const mockInstance = {
        topicId: 100,
        client: {} as any,
        sseAbort: () => {},
        registeredAt: new Date(),
        lastActivityAt: new Date(),
      }

      ;(server as any).topicIdIndex.set(100, mockInstance)

      expect((server as any).isExternalTopic(100)).toBe(true)
      expect((server as any).getExternalByTopic(100)).toBe(mockInstance)
    })

    it("should return false for non-existent topicId", () => {
      const server = new ApiServer({
        port: 4200,
        apiKey: "test_key",
        corsOrigins: "*",
        config: {} as any,
        topicStore: {} as any,
        streamHandler: {} as any,
        bot: {} as any,
      })

      expect((server as any).isExternalTopic(999)).toBe(false)
      expect((server as any).getExternalByTopic(999)).toBeUndefined()
    })

    it("should remove from index on unregister", () => {
      const server = new ApiServer({
        port: 4200,
        apiKey: "test_key",
        corsOrigins: "*",
        config: {} as any,
        topicStore: {
          updateStatus: () => {},
        } as any,
        streamHandler: {} as any,
        bot: {
          api: {
            deleteForumTopic: () => Promise.resolve(),
          },
        } as any,
      })

      const mockInstance = {
        topicId: 200,
        projectPath: "/test/project",
        client: { close: () => {} },
        sseAbort: () => {},
        registeredAt: new Date(),
        lastActivityAt: new Date(),
      }

      ;(server as any).externalInstances.set("/test/project", mockInstance)
      ;(server as any).topicIdIndex.set(200, mockInstance)

      expect((server as any).isExternalTopic(200)).toBe(true)

      ;(server as any).externalInstances.delete("/test/project")
      ;(server as any).topicIdIndex.delete(200)

      expect((server as any).isExternalTopic(200)).toBe(false)
    })
  })
})