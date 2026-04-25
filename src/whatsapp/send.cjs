const { createRequire } = require('module')
const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const fs = require('fs')
const path = require('path')

const AUTH_DIR = "./data/whatsapp"
const PHONE = process.argv[2] || ""

async function main() {
  if (!PHONE) {
    console.log("Usage: node send.cjs <phone>")
    console.log("Example: node send.cjs 573165411800")
    process.exit(1)
  }

  const sessionDir = path.join(AUTH_DIR, "default")
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)

  const conn = makeWASocket({
    auth: state,
    browser: ["OpenCode WhatsApp", "Chrome", "120.0"],
    printQRInTerminal: false,
  })

  conn.ev.on("creds.update", saveCreds)

  conn.ev.on("connection.update", async ({ connection }) => {
    if (connection === "open") {
      console.log("✅ Connected")
      
      const targetJid = `${PHONE}@c.us`
      console.log("→ Enviando a:", targetJid)
      
      const msg = await conn.sendMessage(targetJid, { 
        text: "🎉 *Hola!*\n\nMensaje de prueba del bot de OpenCode WhatsApp.\n\n✅ *Conectado*" 
      })
      console.log("✅ Enviado:", msg.key.id)
      
      setTimeout(() => process.exit(0), 2000)
    }
  })
}

main().catch(e => {
  console.error("Error:", e.message)
  process.exit(1)
})