import { describe, it, expect } from "vitest"
import { sanitizeError } from "../src/config"

describe("sanitizeError", () => {
  describe("Error object handling", () => {
    it("should return error message for Error objects", () => {
      const error = new Error("Something went wrong")
      expect(sanitizeError(error)).toBe("Something went wrong")
    })

    it("should return unknown error for null", () => {
      expect(sanitizeError(null)).toBe("An unknown error occurred")
    })

    it("should return unknown error for undefined", () => {
      expect(sanitizeError(undefined)).toBe("An unknown error occurred")
    })

    it("should handle non-error objects", () => {
      expect(sanitizeError({ foo: "bar" })).toBe("An internal error occurred")
    })
  })

  describe("String error handling", () => {
    it("should return string errors as-is", () => {
      expect(sanitizeError("Simple error message")).toBe("Simple error message")
    })

    it("should trim string errors", () => {
      expect(sanitizeError("  Error with spaces  ")).toBe("Error with spaces")
    })
  })

  describe("Sensitive data removal", () => {
    it("should remove file paths with node_modules", () => {
      const error = new Error("Failed to load /home/user/project/node_modules")
      expect(sanitizeError(error)).toContain("[path]")
    })

    it("should remove src paths", () => {
      const error = new Error("Error in /project/src/utils/helper.ts")
      expect(sanitizeError(error)).toBe("Error in [path]")
    })

    it("should remove stack trace patterns", () => {
      const error = new Error("Error at Function.check (file.ts:10:5)\n    at line 2")
      expect(sanitizeError(error)).toBe("Error")
    })

    it("should remove error codes like [ERR_CONNECTION_REFUSED]", () => {
      const error = new Error("Failed [ERR_CONNECTION_REFUSED] to connect")
      const result = sanitizeError(error)
      expect(result).not.toContain("[ERR_CONNECTION_REFUSED]")
    })

    it("should remove localhost:port patterns", () => {
      const error = new Error("Cannot connect to localhost:3000")
      expect(sanitizeError(error)).toBe("Cannot connect to [host]")
    })

    it("should remove IP addresses", () => {
      const error = new Error("Connection to 192.168.1.100 failed")
      expect(sanitizeError(error)).toBe("Connection to [ip] failed")
    })

    it("should remove database file extensions", () => {
      const error = new Error("Cannot open database.db")
      const result = sanitizeError(error)
      expect(result).not.toContain(".db")
    })

    it("should remove environment variable references", () => {
      const error = new Error("Missing $API_KEY environment variable")
      expect(sanitizeError(error)).toBe("Missing [env] environment variable")
    })
  })

  describe("Absolute path removal", () => {
    it("should remove absolute paths with multiple segments", () => {
      const error = new Error("File not found at /usr/local/bin/script")
      expect(sanitizeError(error)).toBe("File not found at [path]")
    })

    it("should keep relative paths", () => {
      const error = new Error("Missing config file ./config.json")
      expect(sanitizeError(error)).toBe("Missing config file ./config.json")
    })
  })

  describe("Multi-line content", () => {
    it("should only return first line", () => {
      const error = new Error("First line\nSecond line\nThird line")
      expect(sanitizeError(error)).toBe("First line")
    })
  })

  describe("Length limits", () => {
    it("should truncate to 200 characters", () => {
      const longMessage = "x".repeat(300)
      const result = sanitizeError(new Error(longMessage))
      expect(result.length).toBe(200)
    })

    it("should return generic message for very short results", () => {
      const error = new Error("a")
      const result = sanitizeError(error)
      expect(result).toMatch(/internal error|unknown error/i)
    })
  })
})