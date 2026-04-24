/**
 * WhatsApp Client
 *
 * Baileys client configuration with handlers.
 * Supports QR code login, reconnection, and message handling.
 */

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  MessageUpsertType,
} from "@whiskeysockets/baileys"
import * as fs from "fs"
import * as path from "path"
import type { Boom } from "@hapi/boom"
import { handleMessage } from "./handlers/message"
import { createWASession, deleteSession } from "./session"

const AUTH_DIR = "./data/whatsapp"

export interface WhatsAppConfig {
  sessionId?: string
  printQRInTerminal?: boolean
}

export interface WhatsAppClient {
  conn: any
  start: () => Promise<void>
  stop: () => Promise<void>
  sendMessage: (jid: string, text: string) => Promise<any>
  sendText: (jid: string, text: string) => Promise<void>
}

export async function createWhatsAppClient(config: WhatsAppConfig = {}): Promise<WhatsAppClient> {
  const sessionId = config.sessionId || "default"
  const sessionDir = path.join(AUTH_DIR, sessionId)

  await fs.promises.mkdir(sessionDir, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)

  const { version } = await fetchLatestBaileysVersion()

  const conn = makeWASocket({
    version,
    printQRInTerminal: config.printQRInTerminal ?? true,
    auth: state,
    logger: console as any,
    browser: ["OpenCode WhatsApp", "Chrome", "120.0.0"],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
  })

  let clientInstance: WhatsAppClient

  conn.ev.on("creds.update", async () => {
    await saveCreds()
  })

  conn.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log("\n[WhatsApp] Scan this QR code with WhatsApp:\n")
      console.log(qr)
    }

    if (connection === "close") {
      const reason = (lastDisconnect?.error as Boom)?.output?.statusCode
      const shouldReconnect = reason !== DisconnectReason.loggedOut

      console.log(
        "[WhatsApp] Connection closed:",
        DisconnectReason[reason] || reason
      )

      if (shouldReconnect) {
        console.log("[WhatsApp] Reconnecting...")
        setTimeout(() => createWhatsAppClient(config), 5000)
      }
    }

    if (connection === "open") {
      console.log("[WhatsApp] Connected as", conn.user?.id)
    }
  })

  conn.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue

      try {
        await handleMessage(conn, msg)
      } catch (error) {
        console.error("[WhatsApp] Error handling message:", error)
      }
    }
  })

  async function sendText(jid: string, text: string): Promise<void> {
    await conn.sendMessage(jid, { text })
  }

  async function sendMessage(jid: string, text: string): Promise<any> {
    return conn.sendMessage(jid, { text })
  }

  async function start(): Promise<void> {
    console.log("[WhatsApp] Client ready")
  }

  async function stop(): Promise<void> {
    conn.end(undefined)
  }

  clientInstance = {
    conn,
    start,
    stop,
    sendMessage,
    sendText,
  }

  return clientInstance
}

export default { createWhatsAppClient }