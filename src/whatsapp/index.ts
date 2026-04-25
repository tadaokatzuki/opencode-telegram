/**
 * WhatsApp OpenCode Orchestrator
 *
 * Main entry point for the WhatsApp bot that manages OpenCode instances
 * via group chats in WhatsApp.
 *
 * Usage:
 *   bun run src/whatsapp/index.ts
 *
 * Environment:
 *   WHATSAPP_SESSION_ID (optional, default: "default")
 */

import { createWhatsAppClient } from "./client"
import { deleteSession } from "./session"
import { mkdir } from "fs/promises"

async function main() {
  console.log("=".repeat(60))
  console.log("  🤖 OpenCode WhatsApp Bot")
  console.log("=".repeat(60))

  let client: any

  try {
    client = await createWhatsAppClient({
      printQRInTerminal: true,
    })
  } catch (error) {
    console.error("\n[Error] Failed to initialize WhatsApp client:")
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }

  if (!client) {
    console.error("\n[Error] Client not initialized properly")
    process.exit(1)
  }

  let shuttingDown = false

  async function shutdown(signal: string) {
    if (shuttingDown) return
    shuttingDown = true

    console.log(`\n[${signal}] Shutting down gracefully...`)

    try {
      if (client) {
        await client.stop()
      }
      console.log("[Shutdown] Complete")
    } catch (error) {
      console.error("[Shutdown] Error:", error)
    }
  }

  process.on("SIGINT", () => shutdown("SIGINT"))
  process.on("SIGTERM", () => shutdown("SIGTERM"))

  process.on("uncaughtException", (error) => {
    console.error("[Fatal] Uncaught exception:", error)
    shutdown("uncaughtException")
  })

  process.on("unhandledRejection", (reason) => {
    console.error("[Fatal] Unhandled rejection:", reason)
    shutdown("unhandledRejection")
  })

  try {
    console.log("\n[Starting] Initializing WhatsApp client...")
    await client.start()
  } catch (error) {
    console.error("\n[Error] Failed to start client:")
    console.error(error instanceof Error ? error.message : String(error))
  }
}

main().catch((error) => {
  console.error("[Fatal]", error)
})