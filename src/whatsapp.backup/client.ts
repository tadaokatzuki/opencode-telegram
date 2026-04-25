/**
 * WhatsApp Client with Baileys
 * 
 * Supports:
 * - Session management with QR code
 * - Auto reconnection
 * - Message handling
 * - Group management
 * 
 * NOTE: Requires Node.js due to WebSocket limitation in Bun
 * Run separately: node src/whatsapp/whatsapp-node.js
 */

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys"
import * as fs from "fs"
import * as path from "path"
import type { Boom } from "@hapi/boom"
import { toDataURL as generateQR } from "qrcode"
import { handleMessage } from "./handlers/message"
import type { WASession } from "./session"

const AUTH_DIR = "./data/whatsapp"

export interface WhatsAppConfig {
  sessionId?: string
  phoneNumber?: string
}

export interface WhatsAppClient {
  conn: any
  start: () => Promise<void>
  stop: () => Promise<void>
  sendMessage: (jid: string, text: string, options?: any) => Promise<any>
  createGroup: (subject: string, participants: string[]) => Promise<any>
  groupAddMembers: (jid: string, participants: string[]) => Promise<any>
  groupRemoveMembers: (jid: string, participants: string[]) => Promise<any>
  groupInfo: (jid: string) => Promise<any>
  getMe: () => any
}

let reconnectAttempts = 0
const maxReconnectAttempts = 5
const maxReconnectDelay = 30000

export async function createWhatsAppClient(config: WhatsAppConfig = {}): Promise<WhatsAppClient> {
  const sessionId = config.sessionId || "default"
  const phoneNumber = config.phoneNumber || "+540000000000"
  const sessionDir = path.join(AUTH_DIR, sessionId)

  // Ensure auth directory exists
  await fs.promises.mkdir(sessionDir, { recursive: true })

  // Load or create session
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
  const { version } = await fetchLatestBaileysVersion()

  // Silent logger to reduce noise
  function silentLogger() {
    return {
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: () => console.warn,
      error: () => console.error,
      child: () => silentLogger(),
    }
  }

  // Create socket
  const conn = makeWASocket({
    version,
    auth: state,
    browser: ["OpenCode WhatsApp", "Chrome", "120.0"],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    logger: silentLogger() as any,
    // Retry configuration
    retryRequestDelayMs: 3000,
    maxMsgRetryCount: 5,
  })

  let isConnected = false
  let currentClient: WhatsAppClient

  // Handle credentials update
  conn.ev.on("creds.update", async () => {
    await saveCreds()
  })

  // Handle connection updates
  conn.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log("\n" + "═".repeat(50))
      console.log("       📱  WhatsApp QR Login")
      console.log("═".repeat(50) + "\n")
      
      // Generate ASCII QR code for terminal
      qrcode.generate(qr, { small: false }, (qrCode) => {
        console.log(qrCode)
      })
      
      // Also save QR code as PNG image
      const qrImagePath = path.join(sessionDir, "qr.png")
      try {
        const qrDataUrl = await qr.toDataURL(qr, {
          width: 300,
          margin: 2,
          color: { dark: "#000000", light: "#FFFFFF" }
        })
        const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, "")
        await fs.promises.writeFile(qrImagePath, Buffer.from(base64Data, "base64"))
        console.log("[WhatsApp] QR saved to:", qrImagePath)
      } catch (e) {
        console.warn("[WhatsApp] Could not save QR image:", (e as Error).message)
      }
      
      console.log("\n[WhatsApp] Scan with WhatsApp > Settings > Linked Devices")
      console.log("[WhatsApp] Or enter pairing code below:\n")
      
      // Request pairing code
      try {
        const code = await conn.requestPairingCode(phoneNumber)
        console.log("       🔢 Pairing Code: " + code.split("").join(" ") + "\n")
      } catch (e) {
        // Ignore if pairing code fails
      }
      
      console.log("═".repeat(50) + "\n")
    }

    if (connection === "open") {
      isConnected = true
      reconnectAttempts = 0
      console.log("\n✅ WhatsApp Connected:", conn.user?.id || conn.user?.split("@")[0])
      console.log("[WhatsApp] Ready to receive messages\n")
    }

    if (connection === "close") {
      const reason = (lastDisconnect?.error as Boom)?.output?.statusCode
      const shouldReconnect = reason !== DisconnectReason.loggedOut
      
      console.log("[WhatsApp] Connection closed:", lastDisconnect?.error?.message || reason)
      
      if (shouldReconnect && reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++
        const delay = Math.min(5000 * Math.pow(2, reconnectAttempts), maxReconnectDelay)
        console.log(`[WhatsApp] Reconnecting in ${delay/1000}s (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`)
        setTimeout(() => createWhatsAppClient(config), delay)
      }
    }

    if (connection === "failed") {
      console.log("[WhatsApp] Connection failed:", lastDisconnect?.error?.message)
    }
  })

  // Handle incoming messages
  conn.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return
    
    for (const msg of messages) {
      // Skip self messages
      if (msg.key.fromMe) continue
      if (!msg.message) continue
      
      try {
        await handleMessage(conn, msg)
      } catch (error) {
        console.error("[WhatsApp] Error handling message:", error)
      }
    }
  })

  // Client methods
  async function start(): Promise<void> {
    console.log("[WhatsApp] Client initialized")
  }

  async function stop(): Promise<void> {
    conn.end(undefined)
  }

  async function sendMessage(jid: string, text: string, options?: any): Promise<any> {
    return conn.sendMessage(jid, { text }, options)
  }

  async function createGroup(subject: string, participants: string[]): Promise<any> {
    return conn.groupCreate(subject, participants)
  }

  async function groupAddMembers(jid: string, participants: string[]): Promise<any> {
    return conn.groupParticipantsUpdate(jid, participants, "add")
  }

  async function groupRemoveMembers(jid: string, participants: string[]): Promise<any> {
    return conn.groupParticipantsUpdate(jid, participants, "remove")
  }

  async function groupInfo(jid: string): Promise<any> {
    return conn.groupMetadata(jid)
  }

  function getMe(): any {
    return conn.user
  }

  currentClient = {
    conn,
    start,
    stop,
    sendMessage,
    createGroup,
    groupAddMembers,
    groupRemoveMembers,
    groupInfo,
    getMe,
  }

  return currentClient
}

export default { createWhatsAppClient }