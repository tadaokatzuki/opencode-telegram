const { createRequire } = require('module')
const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const fs = require('fs')
const path = require('path')

const AUTH_DIR = "./data/whatsapp"
const PHONE = "573165411800"

async function main() {
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
      console.log("Enviando a:", targetJid)
      
      try {
        const msg = await conn.sendMessage(targetJid, { 
          text: "🎉 *Hola!*\n\nMensaje de prueba del bot de OpenCode.\n\n✅ *Conectado*" 
        })
        console.log("✅ Mensaje enviado:", msg.key.id)
      } catch (e) {
        console.error("Error:", e.message)
      }
      
      setTimeout(() => process.exit(0), 3000)
    }
  })
}

main().catch(console.error)