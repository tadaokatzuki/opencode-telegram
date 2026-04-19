import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { StateStore } from "../src/orchestrator/state-store"
import { PortPool } from "../src/orchestrator/port-pool"

describe("StateStore", () => {
  let store: StateStore
  const testDbPath = ":memory:"

  beforeEach(() => {
    store = new StateStore(testDbPath)
  })

  afterEach(() => {
    store.close()
  })

  describe("saveInstance", () => {
    it("should save instance state", () => {
      store.saveInstance({
        instanceId: "topic-1",
        topicId: 1,
        port: 4100,
        workDir: "/path/to/project",
        state: "running",
        restartCount: 0,
      })

      const instance = store.getInstance("topic-1")
      expect(instance).toBeDefined()
      expect(instance?.workDir).toBe("/path/to/project")
    })

    it("should update existing instance", () => {
      store.saveInstance({
        instanceId: "topic-1",
        topicId: 1,
        port: 4100,
        workDir: "/path/a",
        state: "running",
        restartCount: 0,
      })
      store.saveInstance({
        instanceId: "topic-1",
        topicId: 1,
        port: 4100,
        workDir: "/path/b",
        state: "running",
        restartCount: 1,
      })

      const instance = store.getInstance("topic-1")
      expect(instance?.workDir).toBe("/path/b")
      expect(instance?.restartCount).toBe(1)
    })
  })

  describe("getInstance", () => {
    it("should return null for non-existent instance", () => {
      const instance = store.getInstance("non-existent")
      expect(instance).toBeNull()
    })
  })

  describe("getInstanceByTopic", () => {
    it("should find instance by topic ID", () => {
      store.saveInstance({
        instanceId: "topic-1",
        topicId: 1,
        port: 4100,
        workDir: "/path",
        state: "running",
        restartCount: 0,
      })

      const instance = store.getInstanceByTopic(1)
      expect(instance?.instanceId).toBe("topic-1")
    })
  })

  describe("getInstancesByState", () => {
    it("should filter by state", () => {
      store.saveInstance({
        instanceId: "topic-1",
        topicId: 1,
        port: 4100,
        workDir: "/path",
        state: "running",
        restartCount: 0,
      })
      store.saveInstance({
        instanceId: "topic-2",
        topicId: 2,
        port: 4101,
        workDir: "/path2",
        state: "stopped",
        restartCount: 0,
      })

      const running = store.getInstancesByState(["running"])
      expect(running).toHaveLength(1)
      expect(running[0]?.instanceId).toBe("topic-1")
    })
  })

  describe("updateInstanceState", () => {
    it("should update state", () => {
      store.saveInstance({
        instanceId: "topic-1",
        topicId: 1,
        port: 4100,
        workDir: "/path",
        state: "running",
        restartCount: 0,
      })
      store.updateInstanceState("topic-1", "crashed", "Exit code: 1")

      const instance = store.getInstance("topic-1")
      expect(instance?.state).toBe("crashed")
    })
  })

  describe("deleteInstance", () => {
    it("should delete instance", () => {
      store.saveInstance({
        instanceId: "topic-1",
        topicId: 1,
        port: 4100,
        workDir: "/path",
        state: "running",
        restartCount: 0,
      })
      store.deleteInstance("topic-1")

      expect(store.getInstance("topic-1")).toBeNull()
    })
  })

  describe("markStaleInstancesAsCrashed", () => {
    it("should mark running/starting/stopping as crashed", () => {
      store.saveInstance({
        instanceId: "topic-1",
        topicId: 1,
        port: 4100,
        workDir: "/path",
        state: "running",
        restartCount: 0,
      })

      const count = store.markStaleInstancesAsCrashed()
      expect(count).toBe(1)

      const instance = store.getInstance("topic-1")
      expect(instance?.state).toBe("crashed")
    })
  })

  describe("getStats", () => {
    it("should return statistics", () => {
      store.saveInstance({
        instanceId: "topic-1",
        topicId: 1,
        port: 4100,
        workDir: "/path",
        state: "running",
        restartCount: 0,
      })

      const stats = store.getStats()
      expect(stats.totalInstances).toBe(1)
      expect(stats.byState.running).toBe(1)
    })
  })

  describe("savePortAllocation", () => {
    it("should save port allocation", () => {
      store.savePortAllocation({
        port: 4100,
        instanceId: "topic-1",
        allocatedAt: new Date().toISOString(),
      })

      const allocations = store.getPortAllocations()
      expect(allocations).toHaveLength(1)
      expect(allocations[0]?.port).toBe(4100)
    })
  })

  describe("clearPortAllocations", () => {
    it("should clear all allocations", () => {
      store.savePortAllocation({
        port: 4100,
        instanceId: "topic-1",
        allocatedAt: new Date().toISOString(),
      })
      store.savePortAllocation({
        port: 4101,
        instanceId: "topic-2",
        allocatedAt: new Date().toISOString(),
      })

      store.clearPortAllocations()

      const allocations = store.getPortAllocations()
      expect(allocations).toHaveLength(0)
    })
  })
})

describe("PortPool", () => {
  describe("allocate", () => {
    it("should allocate ports sequentially", () => {
      const pool = new PortPool({ startPort: 4100, poolSize: 10 })

      const port1 = pool.allocate("instance-1")
      const port2 = pool.allocate("instance-2")

      expect(port1).toBe(4100)
      expect(port2).toBe(4101)
    })

    it("should return null when pool is exhausted", () => {
      const pool = new PortPool({ startPort: 4100, poolSize: 2 })

      pool.allocate("instance-1")
      pool.allocate("instance-2")
      const port3 = pool.allocate("instance-3")

      expect(port3).toBeNull()
    })

    it("should reuse released ports", () => {
      const pool = new PortPool({ startPort: 4100, poolSize: 10 })

      const port1 = pool.allocate("instance-1")
      pool.release(port1!)
      const portReuse = pool.allocate("instance-2")

      expect(portReuse).toBe(port1)
    })
  })

  describe("release", () => {
    it("should release allocated port", () => {
      const pool = new PortPool({ startPort: 4100, poolSize: 10 })

      const port = pool.allocate("instance-1")
      pool.release(port!)
      const status = pool.getStatus()

      expect(status.available).toBe(10)
    })
  })

  describe("reserve", () => {
    it("should reserve existing port", () => {
      const pool = new PortPool({ startPort: 4100, poolSize: 10 })

      const result = pool.reserve(4105, "instance-1")
      const status = pool.getStatus()

      expect(result).toBe(true)
      expect(status.available).toBe(9)
    })

    it("should fail to reserve already allocated port", () => {
      const pool = new PortPool({ startPort: 4100, poolSize: 10 })

      pool.allocate("instance-1")
      const result = pool.reserve(4100, "instance-2")

      expect(result).toBe(false)
    })
  })

  describe("getStatus", () => {
    it("should return current status", () => {
      const pool = new PortPool({ startPort: 4100, poolSize: 10 })
      pool.allocate("instance-1")

      const status = pool.getStatus()
      expect(status.total).toBe(10)
      expect(status.allocated).toBe(1)
      expect(status.available).toBe(9)
    })
  })
})