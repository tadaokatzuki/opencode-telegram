import { describe, it, expect } from "vitest"

function isPathWithinBase(path: string, basePath: string): boolean {
  const normalized = path.replace(/\\/g, "/").replace(/\/+/g, "/")
  const baseNormalized = basePath.replace(/\\/g, "/").replace(/\/+/g, "/")
  
  if (!normalized.startsWith(baseNormalized)) {
    return false
  }
  
  if (normalized.includes("..")) {
    return false
  }
  
  return true
}

function validateWorkDir(workDir: string, basePath: string): string | null {
  if (workDir === "/tmp" || workDir.startsWith("/tmp/")) {
    return workDir
  }
  
  if (!isPathWithinBase(workDir, basePath)) {
    return null
  }
  
  return workDir
}

describe("Path Validation Security", () => {
  const basePath = "/home/user/oc-bot"
  
  describe("isPathWithinBase", () => {
    it("should allow paths within base", () => {
      expect(isPathWithinBase("/home/user/oc-bot/project1", basePath)).toBe(true)
      expect(isPathWithinBase("/home/user/oc-bot", basePath)).toBe(true)
    })
    
    it("should block path traversal with ..", () => {
      expect(isPathWithinBase("/home/user/oc-bot/../../../etc/passwd", basePath)).toBe(false)
      expect(isPathWithinBase("/home/user/oc-bot/project/../../../root", basePath)).toBe(false)
    })
    
    it("should block paths outside base", () => {
      expect(isPathWithinBase("/etc/passwd", basePath)).toBe(false)
      expect(isPathWithinBase("/home/user/other-project", basePath)).toBe(false)
      expect(isPathWithinBase("/var/log", basePath)).toBe(false)
    })
    
    it("should handle backslashes", () => {
      expect(isPathWithinBase("/home/user/oc-bot\\project", basePath)).toBe(true)
      expect(isPathWithinBase("/home/user/oc-bot\\..\\..\\etc", basePath)).toBe(false)
    })
    
    it("should handle duplicate slashes", () => {
      expect(isPathWithinBase("/home/user//oc-bot//project", basePath)).toBe(true)
    })
  })
  
  describe("validateWorkDir", () => {
    it("should allow /tmp for general topic", () => {
      expect(validateWorkDir("/tmp", basePath)).toBe("/tmp")
      expect(validateWorkDir("/tmp/session-123", basePath)).toBe("/tmp/session-123")
    })
    
    it("should allow valid project paths", () => {
      expect(validateWorkDir("/home/user/oc-bot/my-project", basePath)).toBe("/home/user/oc-bot/my-project")
    })
    
    it("should block path traversal", () => {
      expect(validateWorkDir("/home/user/oc-bot/../../../etc", basePath)).toBe(null)
      expect(validateWorkDir("/home/user/oc-bot/../../secret", basePath)).toBe(null)
    })
    
    it("should block absolute paths outside base", () => {
      expect(validateWorkDir("/etc/passwd", basePath)).toBe(null)
      expect(validateWorkDir("/root/.ssh", basePath)).toBe(null)
    })
  })
})