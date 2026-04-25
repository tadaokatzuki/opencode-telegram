/**
 * WhatsApp Fork - Run WhatsApp in Node.js subprocess
 * 
 * Since Bun doesn't support WebSocket, we run WhatsApp
 * in a Node.js child process.
 * 
 * Usage:
 *   bun run src/whatsapp/fork.ts
 * 
 * This will:
 * 1. Check if running in Bun
 * 2. Fork to Node.js if needed
 * 3. Run WhatsApp client in child process
 */

import { spawn } from "child_process"
import * as fs from "fs"
import * as path from "path"

const SCRIPT_PATH = path.join(__dirname, "whatsapp-node.ts")
const IS_BUN = typeof Bun !== "undefined"

async function main() {
  console.log("═".repeat(50))
  console.log("   WhatsApp Bot (Forked to Node.js)")
  console.log("═".repeat(50)))
  console.log()

  if (!IS_BUN) {
    console.log("Running with Node.js - importing directly...\n")
    // Import and run directly
    const { createWhatsAppClient } = await import("./client")
    const client = await createWhatsAppClient({
      phoneNumber: process.env.WHATSAPP_PHONE_NUMBER,
    })
    await client.start()
    console.log("\n✅ WhatsApp Bot started!")
    return
  }

  // We're in Bun - need to fork to Node.js
  console.log("⚠️  Bun detected - forking to Node.js...\n")

  const nodePath = process.env.PATH?.split(":")?.find(p => 
    fs.existsSync(path.join(p, "node"))
  ) || "/usr/bin/node"

  const child = spawn(nodePath, ["-e", `
    const { createWhatsAppClient } = require('./src/whatsapp/client.ts');
    (async () => {
      const client = await createWhatsAppClient({
        phoneNumber: process.env.WHATSAPP_PHONE_NUMBER,
      });
      await client.start();
      console.log('✅ WhatsApp Bot started via Node.js!');
    })();
  `], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  })

  child.on("exit", (code) => {
    console.log(`[WhatsApp] Child process exited with code ${code}`)
    process.exit(code || 0)
  })
}

main().catch(console.error)