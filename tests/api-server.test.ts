import { describe, it, expect } from "vitest"
import { ApiServer } from "../src/api-server"

const createServer = () => {
  return new ApiServer({
    port: 4200,
    apiKey: "test_key",
    corsOrigins: "*",
    config: {} as any,
    topicStore: {} as any,
    streamHandler: {} as any,
    bot: {} as any,
  })
}

describe("ApiServer Security", () => {
  describe("isValidPath", () => {
    it("should reject empty paths", () => {
      const server = createServer()
      expect((server as any).isValidPath("")).toBe(false)
    })

    it("should reject path traversal attempts", () => {
      const server = createServer()
      expect((server as any).isValidPath("../etc")).toBe(false)
      expect((server as any).isValidPath("..\\windows")).toBe(false)
      expect((server as any).isValidPath("/path/../etc")).toBe(false)
    })

    it("should reject null bytes", () => {
      const server = createServer()
      expect((server as any).isValidPath("/path\0/etc")).toBe(false)
    })

    it("should reject sensitive system paths", () => {
      const server = createServer()
      expect((server as any).isValidPath("/etc")).toBe(false)
      expect((server as any).isValidPath("/etc/passwd")).toBe(false)
      expect((server as any).isValidPath("/root")).toBe(false)
      expect((server as any).isValidPath("/home")).toBe(false)
      expect((server as any).isValidPath("/var")).toBe(false)
      expect((server as any).isValidPath("/tmp")).toBe(false)
      expect((server as any).isValidPath("/proc")).toBe(false)
      expect((server as any).isValidPath("/sys")).toBe(false)
    })

    it("should accept valid project paths outside sensitive dirs", () => {
      const server = createServer()
      // These are NOT in the blocked list
      expect((server as any).isValidPath("/data/projects/myapp")).toBe(true)
      expect((server as any).isValidPath("/workspace/code")).toBe(true)
    })
  })

  describe("sanitizeProjectName", () => {
    it("should reject empty names", () => {
      const server = createServer()
      expect((server as any).sanitizeProjectName("")).toBeNull()
    })

    it("should reject names that are too long", () => {
      const server = createServer()
      const longName = "a".repeat(101)
      expect((server as any).sanitizeProjectName(longName)).toBeNull()
    })

    it("should remove dangerous characters", () => {
      const server = createServer()
      expect((server as any).sanitizeProjectName("test<span>")).toBe("testspan")
      expect((server as any).sanitizeProjectName("test:pipe|")).toBe("testpipe")
    })

    it("should accept valid names", () => {
      const server = createServer()
      expect((server as any).sanitizeProjectName("my-project")).toBe("my-project")
      expect((server as any).sanitizeProjectName("project_name")).toBe("project_name")
      expect((server as any).sanitizeProjectName("Project 123")).toBe("Project 123")
    })

    it("should reject names over 100 chars", () => {
      const server = createServer()
      const longName = "a".repeat(150)
      expect((server as any).sanitizeProjectName(longName)).toBeNull()
    })
  })

  describe("secureCompare", () => {
    it("should return true for identical strings", () => {
      const server = createServer()
      const result = (server as any).secureCompare("abc", "abc")
      expect(result).toBe(true)
    })

    it("should return false for different strings", () => {
      const server = createServer()
      const result = (server as any).secureCompare("abc", "def")
      expect(result).toBe(false)
    })

    it("should return false for different lengths", () => {
      const server = createServer()
      const result = (server as any).secureCompare("abc", "abcd")
      expect(result).toBe(false)
    })
  })
})