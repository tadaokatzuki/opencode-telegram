/**
 * Runtime Shim - Detect Bun vs Node and provide compatible APIs
 */

import { spawn as nodeSpawn, execSync, ChildProcess } from "child_process"
import * as fs from "fs"
import * as http from "http"

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
  exists(): boolean
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

interface ShellResult {
  text(): Promise<string>
  quiet(): Promise<void>
}

function nodeExec(str: string): ShellResult {
  return {
    text: async () => {
      try {
        return execSync(str, { encoding: "utf-8" }) as string
      } catch (e: any) {
        return e.stdout || ""
      }
    },
    quiet: async () => {
      execSync(str, { encoding: "utf-8", stdio: "ignore" })
    },
  }
}

function bunExec(str: string): ShellResult {
  return Bun.$`${str}` as any
}

export const $ = {
  // Template string version: await $.text`command ${var}`
  async text(strings: TemplateStringsArray, ...values: any[]): Promise<string> {
    const cmd = String.raw({ raw: strings }, ...values)
    if (isBun) {
      return (await bunExec(cmd)).text()
    }
    return (await nodeExec(cmd)).text()
  },

  // Direct string version: await $("command")
  async textDirect(str: string): Promise<string> {
    if (isBun) {
      return (await bunExec(str)).text()
    }
    return (await nodeExec(str)).text()
  },

  async quiet(strings: TemplateStringsArray, ...values: any[]): Promise<void> {
    const cmd = String.raw({ raw: strings }, ...values)
    if (isBun) {
      await (await bunExec(cmd)).quiet()
      return
    }
    await nodeExec(cmd).quiet()
  },

  async quietDirect(str: string): Promise<void> {
    if (isBun) {
      await (await bunExec(str)).quiet()
      return
    }
    await nodeExec(str).quiet()
  },

  // Call as function: $(`command`) - returns text directly
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
    exists: () => fs.existsSync(filepath),
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