/**
 * WhatsApp Bot - Run with Node.js
 * 
 * Usage:
 *   node src/whatsapp/run.js
 * 
 * Note: Project uses "type": "module", so we use .js extension
 * with dynamic import to load CommonJS modules
 */

import { createRequire } from 'module'

const require = createRequire(import.meta.url)

const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const pino = require('pino')
const QRCode = require('qrcode')
const fs = require('fs')
const path = require('path')

const AUTH_DIR = "./data/whatsapp"
const phoneNumber = process.env.WHATSAPP_PHONE_NUMBER || "+540000000000"

// Silent logger to reduce noise
function silentLogger() {
  return {
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: console.error,
    child: () => silentLogger(),
  }
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
    logger: pino({ level: 'silent' }),
  })

  let reconnectAttempts = 0

  conn.ev.on("creds.update", saveCreds)

  conn.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log("\n" + "═".repeat(50))
      console.log("       📱 QR Login")
      console.log("═".repeat(50) + "\n")
      
      // Generate QR as simple UTF8 text
      QRCode.toString(qr, { type: "utf8", small: false }, (err, qrText) => {
        if (!err) console.log(qrText)
      })
      
      // Save QR as PNG image
      const qrImagePath = path.join(sessionDir, "qr.png")
      try {
        const qrDataUrl = await QRCode.toDataURL(qr, {
          width: 300,
          margin: 2,
          color: { dark: "#000000", light: "#FFFFFF" }
        })
        const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, "")
        fs.writeFileSync(qrImagePath, Buffer.from(base64Data, "base64"))
        console.log("[WhatsApp] QR image saved to:", qrImagePath)
      } catch (e) {
        console.warn("[WhatsApp] Could not save QR:", e.message)
      }
      
      console.log("\n[WhatsApp] Scan with WhatsApp > Linked Devices\n")
      
      try {
        const code = await conn.requestPairingCode(phoneNumber)
        console.log("       Code: " + code + "\n")
      } catch (e) {}

      console.log("═".repeat(50) + "\n")
    }

    if (connection === "open") {
      console.log("✅ Connected:", conn.user?.id || conn.user?.split("@")[0])
      reconnectAttempts = 0
      
      // Auto-join group if link provided in env
      const inviteLink = process.env.WHATSAPP_INVITE_LINK
      if (inviteLink) {
        let inviteCode = inviteLink
        if (inviteCode.includes("chat.whatsapp.com/")) {
          inviteCode = inviteCode.split("chat.whatsapp.com/")[1].split("?")[0]
        }
        try {
          console.log("Joining group:", inviteCode)
          const jid = await conn.groupAcceptInvite(inviteCode)
          console.log("✅ Joined group:", jid)
        } catch (e) {
          console.log("❌ Failed to join:", e.message)
        }
      }
    }

    if (connection === "close") {
      const reason = (lastDisconnect?.error)?.output?.statusCode
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
      
      const parts = body.slice(1).split(" ")
      const command = parts[0].toLowerCase()
      
      console.log(`Command: /${command} from ${chat}`)
      
      try {
        if (command === "start" || command === "help") {
          await conn.sendMessage(chat, {
            text: "✅ *WhatsApp Bot Active*\n\n" +
               "Commands:\n" +
               "• /start - Show this\n" +
               "• /ping - Test\n" +
               "• /join <link> - Join group\n" +
               "• /group <jid> - Group info\n\n" +
               "_Powered by Baileys_",
          }, { quoted: msg })
        }
        else if (command === "ping") {
          await conn.sendMessage(chat, { text: "🏓 Pong!" }, { quoted: msg })
        }
        else if (command === "join" && parts[1]) {
          // Extract invite code from link
          let inviteCode = parts[1]
          if (inviteCode.includes("chat.whatsapp.com/")) {
            inviteCode = inviteCode.split("chat.whatsapp.com/")[1].split("?")[0]
          }
          try {
            const jid = await conn.groupAcceptInvite(inviteCode)
            await conn.sendMessage(chat, {
              text: `✅ *Joined group!*\n\nJID: ${jid}`,
            }, { quoted: msg })
          } catch (e) {
            await conn.sendMessage(chat, {
              text: `❌ *Error joining group*\n\n${e.message}`,
            }, { quoted: msg })
          }
        }
        else if (command === "group" && parts[1]) {
          const jid = parts[1]
          const meta = await conn.groupMetadata(jid)
          await conn.sendMessage(chat, {
            text: `📋 *${meta.subject}*\n\nMembers: ${meta.participants.length}`,
          }, { quoted: msg })
        }
      } catch (e) {
        console.error("Error:", e)
      }
    }
  })

  process.on("SIGINT", () => {
    console.log("\n[WhatsApp] Shutting down...")
    conn.end(undefined)
    process.exit(0)
  })
}

main().catch(console.error)