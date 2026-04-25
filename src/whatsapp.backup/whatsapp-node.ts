/**
 * WhatsApp Standalone Bot (Node.js Required)
 * 
 * This script runs the WhatsApp client separately using Node.js
 * because Bun doesn't support WebSocket (required by Baileys).
 * 
 * Usage:
 *   node src/whatsapp/whatsapp-node.js
 * 
 * Or run with bun but it'll fork to node:
 *   bun run src/whatsapp/whatsapp-node.js
 */

import { createWhatsAppClient } from "./client"

async function main() {
  console.log("═".repeat(50))
  console.log("   WhatsApp Bot - OpenCode Integration")
  console.log("═".repeat(50))
  console.log()

  // Check if Bun (warn user)
  if (typeof Bun !== "undefined") {
    console.log("⚠️  Bun detected - forking to Node.js...")
  }

  try {
    const client = await createWhatsAppClient({
      phoneNumber: process.env.WHATSAPP_PHONE_NUMBER,
    })

    await client.start()

    console.log("\n[WhatsApp] Bot is ready!")
    console.log("[WhatsApp] Scan the QR code to connect.\n")

  } catch (error) {
    console.error("[WhatsApp] Failed to start:", error)
    process.exit(1)
  }
}

main().catch(console.error)