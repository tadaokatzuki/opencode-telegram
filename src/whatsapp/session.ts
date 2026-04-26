/**
 * WhatsApp Session Management
 * 
 * Handles authentication persistence using Baileys multi-file auth state.
 * Stores credentials in JSON files for session persistence.
 */

import { useMultiFileAuthState } from "@whiskeysockets/baileys"
import type { AuthenticationCreds, AuthenticationState } from "@whiskeysockets/baileys"
import * as fs from "fs"
import * as path from "path"

const AUTH_DIR = "./data/whatsapp"

export interface WASession {
  id: string
  name: string
  createdAt: number
  lastSeenAt: number
}

/**
 * Get all saved sessions
 */
export async function getSavedSessions(): Promise<WASession[]> {
  const authPath = path.resolve(AUTH_DIR)
  
  if (!fs.existsSync(authPath)) {
    return []
  }
  
  const sessions: WASession[] = []
  const dirs = fs.readdirSync(authPath)
  
  for (const dir of dirs) {
    const credsPath = path.join(authPath, dir, "creds.json")
    if (fs.existsSync(credsPath)) {
      try {
        const creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"))
        sessions.push({
          id: dir,
          name: dir,
          createdAt: creds.created || Date.now(),
          lastSeenAt: fs.statSync(credsPath).mtimeMs,
        })
      } catch (e) {
        // Ignore invalid sessions
      }
    }
  }
  
  return sessions.sort((a, b) => b.lastSeenAt - a.lastSeenAt)
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const sessionDir = path.join(AUTH_DIR, sessionId)
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true })
  }
}

/**
 * Check if session exists
 */
export async function sessionExists(sessionId: string): Promise<boolean> {
  const credsPath = path.join(AUTH_DIR, sessionId, "creds.json")
  return fs.existsSync(credsPath)
}

/**
 * Get session info
 */
export async function getSessionInfo(sessionId: string): Promise<WASession | null> {
  const credsPath = path.join(AUTH_DIR, sessionId, "creds.json")
  
  if (!fs.existsSync(credsPath)) {
    return null
  }
  
  try {
    const creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"))
    return {
      id: sessionId,
      name: sessionId,
      createdAt: creds.created || Date.now(),
      lastSeenAt: fs.statSync(credsPath).mtimeMs,
    }
  } catch {
    return null
  }
}

/**
 * Get auth state for a session
 */
export async function getAuthState(
  sessionId: string
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const sessionDir = path.join(AUTH_DIR, sessionId)
  await fs.promises.mkdir(sessionDir, { recursive: true })
  return useMultiFileAuthState(sessionDir)
}

export default {
  getSavedSessions,
  deleteSession,
  sessionExists,
  getSessionInfo,
  getAuthState,
}