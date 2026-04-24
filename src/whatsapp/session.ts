/**
 * WhatsApp Session Management
 *
 * Handles authentication persistence for WhatsApp using Baileys.
 * Supports QR code login and automatic reconnection.
 */

import {
  useMultiFileAuthState,
  DisconnectReason,
} from "@whiskeysockets/baileys"
import * as fs from "fs"
import * as path from "path"

const AUTH_DIR = "./data/whatsapp"

export async function createWASession(config: { sessionId?: string } = {}): Promise<{
  state: any
  saveCreds: () => Promise<void>
}> {
  const sessionId = config.sessionId || "default"
  const sessionDir = path.join(AUTH_DIR, sessionId)

  await fs.promises.mkdir(sessionDir, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)

  return {
    state,
    saveCreds,
  }
}

export async function deleteSession(sessionId: string = "default"): Promise<void> {
  const sessionDir = path.join(AUTH_DIR, sessionId)

  if (fs.existsSync(sessionDir)) {
    await fs.promises.rm(sessionDir, { recursive: true, force: true })
  }
}

export function getPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "")
}

export function isGroupJid(jid: string): boolean {
  return jid.endsWith("@g.us")
}

export function isUserJid(jid: string): boolean {
  return jid.endsWith("@s.whatsapp.net")
}

export function jidToPhone(jid: string): string {
  return jid.replace("@s.whatsapp.net", "").replace("@c.us", "")
}

export function phoneToJid(phone: string): string {
  const num = getPhoneNumber(phone)
  return `${num}@s.whatsapp.net`
}

export function groupJidToId(jid: string): string {
  return jid.replace("@g.us", "")
}

export function idToGroupJid(id: string): string {
  return `${id}@g.us`
}