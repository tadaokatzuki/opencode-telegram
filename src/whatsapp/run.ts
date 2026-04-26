/**
 * WhatsApp Bot - Run with Node.js
 * 
 * Since Bun doesn't support WebSocket needed by Baileys,
 * run this file with Node.js directly:
 * 
 *   node --loader ts-node/esm src/whatsapp/whatsapp-node.ts
 *   # OR
 *   bunx tsx src/whatsapp/whatsapp-node.ts
 */

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys"
import * as fs from "fs"
import * as path from "path"
import type { Boom } from "@hapi/boom"
import qrcode from "qrcode-terminal"

const AUTH_DIR = "./data/whatsapp"

const config = {
  phoneNumber: process.env.WHATSAPP_PHONE_NUMBER || "+540000000000",
}

async function main() {
  console.log("\n" + "═".repeat(50))
  console.log("   📱 WhatsApp Bot")
  console.log("═".repeat(50) + "\n")

  const sessionDir = path.join(AUTH_DIR, "default")
  await fs.promises.mkdir(sessionDir, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
  const { version } = await fetchLatestBaileysVersion()

  const conn = makeWASocket({
    version,
    auth: state,
    browser: ["OpenCode WhatsApp", "Chrome", "120.0"],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
  })

  let reconnectAttempts = 0

  conn.ev.on("creds.update", saveCreds)

  conn.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log("\n" + "═".repeat(50))
      console.log("       📱 QR Login")
      console.log("═".repeat(50) + "\n")
      
      qrcode.generate(qr, { small: false }, (code) => {
        console.log(code)
      })
      
      console.log("\n[WhatsApp] Scan with WhatsApp > Linked Devices\n")
      
      try {
        const code = await conn.requestPairingCode(config.phoneNumber)
        console.log("       Code: " + code + "\n")
      } catch (e) {}

      console.log("═".repeat(50) + "\n")
    }

    if (connection === "open") {
      const userId = typeof conn.user?.id === 'string' ? conn.user.id.split("@")[0] : String(conn.user?.id)
      console.log("✅ Connected:", userId)
      reconnectAttempts = 0
    }

    if (connection === "close") {
      const reason = (lastDisconnect?.error as Boom)?.output?.statusCode
      const shouldReconnect = reason !== DisconnectReason.loggedOut
      
      console.log("❌ Closed:", lastDisconnect?.error?.message || reason)
      
      if (shouldReconnect && reconnectAttempts < 5) {
        reconnectAttempts++
        const delay = 5000 * Math.pow(2, reconnectAttempts)
        console.log(`Reconnecting in ${delay/1000}s (attempt ${reconnectAttempts})...`)
        setTimeout(() => main(), delay)
      }
    }
  })

  conn.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return
    
    for (const msg of messages) {
      if (msg.key.fromMe || !msg.message) continue
      
      const chat = msg.key.remoteJid
      let body = msg.message?.conversation || 
               msg.message?.extendedTextMessage?.text ||
               msg.message?.imageMessage?.caption || ""
      
      if (!body.startsWith("/")) continue
      
      const command = body.slice(1).split(" ")[0].toLowerCase()
      
      console.log(`Command: /${command} from ${chat}`)
      
      try {
        if (command === "start" || command === "help") {
          await conn.sendMessage(chat, {
            text: "✅ *WhatsApp Bot Active*\n\n" +
               "Commands:\n" +
               "• /start - Show this\n" +
               "• /ping - Test\n" +
               "• /group <jid> - Group info\n\n" +
               "_Powered by Baileys_",
          }, { quoted: msg })
        }
        else if (command === "ping") {
          await conn.sendMessage(chat, { text: "🏓 Pong!" }, { quoted: msg })
        }
        else if (command === "group" && msg.message?.extendedTextMessage?.text?.includes(" ")) {
          const jid = msg.message.extendedTextMessage.text.split(" ")[1]
          if (jid) {
            const meta = await conn.groupMetadata(jid)
            await conn.sendMessage(chat, {
              text: `📋 *${meta.subject}*\n\nMembers: ${meta.participants.length}`,
            }, { quoted: msg })
          }
        }
      } catch (e) {
        console.error("Error:", e)
      }
    }
  })

  // Keep process alive
  process.on("SIGINT", () => {
    console.log("\n[WhatsApp] Shutting down...")
    conn.end(undefined)
    process.exit(0)
  })
}

main().catch(console.error)