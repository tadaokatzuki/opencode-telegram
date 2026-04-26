/**
 * Runtime Shim - Detect Bun vs Node and provide compatible APIs
 */

import { spawn as nodeSpawn, execSync, ChildProcess } from "child_process"
import * as fs from "fs"
import * as http from "http"
import * as path from "path"

const isBun = typeof Bun !== "undefined"

interface SpawnResult {
  pid: number
  kill: () => void
  stdout: any
  stderr: any
  exited: Promise<number>
  exitCode?: number
}

interface FileResult {
  exists(): Promise<boolean>
  text(): Promise<string>
  json(): Promise<any>
}

function nodeSpawnCommand(args: string[]): SpawnResult {
  const cmd = args[0]
  const cmdArgs = args.slice(1)
  const proc = nodeSpawn(cmd, cmdArgs, {
    stdio: ["ignore", "pipe", "pipe"],
  }) as any

  return {
    pid: proc.pid || 0,
    kill: () => proc.kill(),
    stdout: proc.stdout,
    stderr: proc.stderr,
    exited: new Promise((resolve) => {
      proc.on("exit", (code: number) => resolve(code || 0))
    }),
    exitCode: proc.exitCode,
  }
}

function bunSpawnCommand(args: string[]): SpawnResult {
  const proc = Bun.spawn(args as [string, ...string[]]) as any
  return {
    pid: proc.pid,
    kill: () => proc.kill(),
    stdout: proc.stdout,
    stderr: proc.stderr,
    exited: proc.exited,
    exitCode: proc.exitCode,
  }
}

function nodeExecSafe(args: string[]): { stdout: string; exitCode: number } {
  try {
    const result = nodeSpawn(args[0], args.slice(1), {
      stdio: ["ignore", "pipe", "pipe"],
    }) as any

    let stdout = ""
    let stderr = ""

    if (result.stdout) {
      result.stdout.on("data", (data: Buffer) => { stdout += data.toString() })
    }
    if (result.stderr) {
      result.stderr.on("data", (data: Buffer) => { stderr += data.toString() })
    }

    const exitCode = result.exitCode
    return { stdout, exitCode }
  } catch (e: any) {
    return { stdout: "", exitCode: e.status || 1 }
  }
}

function nodeExecQuietSafe(args: string[]): { stdout: any; exitCode: number } {
  try {
    const proc = nodeSpawn(args[0], args.slice(1), {
      stdio: ["ignore", "ignore", "ignore"],
    }) as any

    return {
      stdout: null,
      exitCode: proc.exitCode || 0,
    }
  } catch (e: any) {
    return { stdout: null, exitCode: e.status || 1 }
  }
}

function nodeExecQuiet(): { stdout: any; exitCode: number; text: () => string } {
  return {
    stdout: null,
    exitCode: 0,
    text: () => "",
  }
}

function bunExec(str: string): { text: () => Promise<string> } {
  return { text: async () => (Bun.$`${str}` as any).text() }
}

function bunExecQuiet(str: string): { exitCode: number } {
  const proc = Bun.spawn(str.split(" ")) as any
  return { exitCode: proc.exitCode || 0 }
}

export const $ = {
  async text(strings: TemplateStringsArray, ...values: any[]): Promise<string> {
    const cmd = String.raw({ raw: strings }, ...values)
    if (isBun) {
      return (await bunExec(cmd)).text()
    }
    const args = cmd.split(/\s+/)
    return nodeExecSafe(args).stdout
  },

  async textDirect(str: string): Promise<string> {
    if (isBun) {
      return (await bunExec(str)).text()
    }
    const args = str.split(/\s+/)
    return nodeExecSafe(args).stdout
  },

  async quiet(strings: TemplateStringsArray, ...values: any[]): Promise<{ stdout: any; exitCode: number }> {
    const cmd = String.raw({ raw: strings }, ...values)
    if (isBun) {
      try {
        const exitCode = bunExecQuiet(cmd).exitCode
        return { stdout: null, exitCode }
      } catch {
        return { stdout: null, exitCode: 1 }
      }
    }
    const args = cmd.split(/\s+/)
    return nodeExecQuietSafe(args)
  },

  async quietDirect(str: string): Promise<{ stdout: any; exitCode: number }> {
    if (isBun) {
      try {
        const exitCode = bunExecQuiet(str).exitCode
        return { stdout: null, exitCode }
      } catch {
        return { stdout: null, exitCode: 1 }
      }
    }
    const args = str.split(/\s+/)
    return nodeExecQuietSafe(args)
  },

  async listDir(dirPath: string): Promise<string[]> {
    if (isBun) {
      try {
        const files = await (Bun as any).readdir(dirPath)
        return Array.from(files).map((f: any) => typeof f === 'string' ? f : f.name)
      } catch {
        return []
      }
    }
    try {
      const result = nodeExecSafe(["ls", "-1", dirPath])
      return result.stdout.split('\n').filter(Boolean)
    } catch {
      return []
    }
  },

  async isDirectory(dirPath: string): Promise<boolean> {
    if (isBun) {
      try {
        const stat = await (Bun as any).stat(dirPath)
        return stat.isDirectory()
      } catch {
        return false
      }
    }
    const result = nodeExecQuietSafe(["test", "-d", dirPath])
    return result.exitCode === 0
  },

  async exists(filePath: string): Promise<boolean> {
    if (isBun) {
      return Bun.file(filePath).exists()
    }
    return fs.existsSync(filePath)
  },

  async call(str: string): Promise<string> {
    return this.textDirect(str)
  },

  spawn(args: string[]): SpawnResult {
    if (isBun) {
      return bunSpawnCommand(args)
    }
    return nodeSpawnCommand(args)
  },
}

export function file(filepath: string): FileResult {
  if (isBun) {
    const f = Bun.file(filepath) as any
    return {
      exists: async () => await f.exists(),
      text: async () => await f.text(),
      json: async () => await f.json(),
    }
  }
  return {
    exists: async () => fs.existsSync(filepath),
    text: async () => fs.readFileSync(filepath, "utf-8"),
    json: async () => JSON.parse(fs.readFileSync(filepath, "utf-8")),
  }
}

export function spawn(args: string[]): SpawnResult {
  return $.spawn(args)
}

export function serve(options: any): any {
  if (isBun) {
    return Bun.serve(options)
  }

  const server = http.createServer(async (req, res) => {
    try {
      const request = new Request(`http://localhost${req.url}`, {
        method: req.method,
        headers: req.headers as any,
      })

      const response = await options.fetch(request)

      res.statusCode = response.status
      response.headers.forEach((value: string, key: string) => {
        res.setHeader(key, value)
      })

      const body = await response.text()
      res.end(body)
    } catch (e: any) {
      res.statusCode = 500
      res.end(e.message)
    }
  })

  server.listen(options.port, options.hostname)
  return server
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default {
  $,
  file,
  spawn,
  serve,
  sleep,
  isBun,
}