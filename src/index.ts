
/**
 * Telegram OpenCode Orchestrator
 * 
 * Main entry point for the Telegram bot that manages OpenCode instances
 * via forum topics in a Telegram supergroup.
 * 
 * Usage:
 *   bun run src/index.ts
 * 
 * Environment:
 *   See .env.example for required configuration
 */

import { loadConfig, validateConfig, printConfig } from "./config"
import { createIntegratedApp } from "./integration"
import { mkdir } from "fs/promises"

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("=".repeat(60))
  console.log("  🤖 Orchestrator BOT (Multi-Topic - Forum Topics)")
  console.log("=".repeat(60))

  // Load configuration
  let config
  try {
    config = loadConfig()
  } catch (error) {
    console.error("\n[Error] Failed to load configuration:")
    console.error(error instanceof Error ? error.message : String(error))
    console.error("\nMake sure you have set the required environment variables.")
    console.error("See .env.example for reference.")
    process.exit(1) // Error de inicialización -，必须 salir
  }

  // Validate configuration
  const validation = validateConfig(config)
  if (!validation.valid) {
    console.error("\n[Error] Invalid configuration:")
    for (const error of validation.errors) {
      console.error(`  - ${error}`)
    }
    process.exit(1) // Config inválida - 必须 salir
  }

  // Print configuration (with sensitive values masked)
  printConfig(config)

  // Ensure data directory exists
  try {
    await mkdir("./data", { recursive: true })
  } catch {
    // Ignore errors
  }

  // Create the integrated application
  let app: Awaited<ReturnType<typeof createIntegratedApp>> | undefined
  try {
    app = await createIntegratedApp(config)
  } catch (error) {
    console.error("\n[Error] Failed to initialize application:")
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1) // Error de inicialización - 必须 salir
  }

  // Check app was created
  if (!app) {
    console.error("\n[Error] App not initialized properly")
    process.exit(1) // Error de inicialización - 必须 salir
  }

  // Set up graceful shutdown
  let shuttingDown = false

  async function shutdown(signal: string) {
    if (shuttingDown) return
    shuttingDown = true

    console.log(`\n[${signal}] Shutting down gracefully...`)
    
    try {
      if (app) {
        await app.stop()
      }
      console.log("[Shutdown] Complete")
      return // No process.exit() - dejar que Bun termine naturalmente
    } catch (error) {
      console.error("[Shutdown] Error:", error)
      return
    }
  }

  process.on("SIGINT", () => shutdown("SIGINT"))
  process.on("SIGTERM", () => shutdown("SIGTERM"))

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    console.error("[Fatal] Uncaught exception:", error)
    shutdown("uncaughtException")
  })

  process.on("unhandledRejection", (reason) => {
    console.error("[Fatal] Unhandled rejection:", reason)
    shutdown("unhandledRejection")
  })

  // Start the application
  try {
    console.log("\n[Starting] Initializing bot and orchestrator...")
    await app.start()
  } catch (error) {
    console.error("\n[Error] Failed to start application:")
    console.error(error instanceof Error ? error.message : String(error))
    return // No process.exit()
  }
}

// Run
main().catch((error) => {
  console.error("[Fatal]", error)
  // No process.exit() - dejar que Bun maneje el error
})
