/**
 * WhatsApp Message Handler
 * 
 * Processes incoming messages and generates responses.
 * Supports commands, text processing, and markdown.
 */

import type { WASocket } from "@whiskeysockets/baileys"
import type { Message } from "@whiskeysockets/baileys/iobuffer"
import { msgSourcePattern } from "@whiskeysockets/baileys/lib/Utils/generics"

export interface ProcessedMessage {
  id: string
  from: string
  body: string
  isCommand: boolean
  command?: string
  args?: string[]
  isGroup: boolean
  sender?: string
  pushName?: string
  quoted?: any
}

/**
 * Process incoming message and extract info
 */
export function processMessage(msg: any): ProcessedMessage {
  const chat = msg.key.remoteJid
  const isGroup = chat?.endsWith("@g.us")
  
  // Get message body
  let body = ""
  if (msg.message?.conversation) {
    body = msg.message.conversation
  } else if (msg.message?.extendedTextMessage?.text) {
    body = msg.message.extendedTextMessage.text
  } else if (msg.message?.imageMessage?.caption) {
    body = msg.message.imageMessage.caption
  } else if (msg.message?.videoMessage?.caption) {
    body = msg.message.videoMessage.caption
  }
  
  // Check if command
  const isCommand = body.startsWith("/")
  let command: string | undefined
  let args: string[] = []
  
  if (isCommand) {
    const parts = body.slice(1).split(" ")
    command = parts[0].toLowerCase()
    args = parts.slice(1)
  }
  
  return {
    id: msg.key.id,
    from: chat,
    body,
    isCommand,
    command,
    args,
    isGroup,
    sender: msg.key.participant,
    pushName: msg.pushName,
    quoted: msg.message?.extendedTextMessage?.contextInfo?.quotedMessage,
  }
}

/**
 * Handle incoming message and respond
 */
export async function handleMessage(conn: any, msg: any, orchestratorUrl?: string): Promise<void> {
  const processed = processMessage(msg)
  
  // Handle commands
  if (processed.isCommand) {
    console.log(`[WhatsApp] Command: /${processed.command} from ${processed.from}`)
    
    // Process command switch
    switch (processed.command) {
      case "start":
        await conn.sendMessage(processed.from, {
          text: "✅ *WhatsApp Bot Active*\n\n" +
             "Commands:\n" +
             "• /help - Show help\n" +
             "• /ping - Test connection\n" +
             "• Just send a message to chat with OpenCode!",
        }, { quoted: msg })
        break
        
      case "help":
        await conn.sendMessage(processed.from, {
          text: "📚 *WhatsApp Commands*\n\n" +
             "• /start - Start bot\n" +
             "• /help - Show this help\n" +
             "• /ping - Test connection\n\n" +
             "_Just send any message to chat with OpenCode!_",
        }, { quoted: msg })
        break
        
      case "ping":
        await conn.sendMessage(processed.from, {
          text: "🏓 Pong!",
        }, { quoted: msg })
        break
        
      case "status":
        await conn.sendMessage(processed.from, {
          text: "✅ Bot running\n_Use /ping to test_",
        }, { quoted: msg })
        break
        
      default:
        // Unknown command - try to forward to OpenCode
        if (orchestratorUrl) {
          await forwardToOrchestrator(conn, processed.from, processed.body, msg, orchestratorUrl)
        } else {
          await conn.sendMessage(processed.from, {
            text: "❓ Unknown command. Use /help for available commands.",
          }, { quoted: msg })
        }
    }
    return
  }
  
  // Non-command messages - forward to orchestrator
  if (orchestratorUrl && processed.body.trim()) {
    await forwardToOrchestrator(conn, processed.from, processed.body, msg, orchestratorUrl)
  }
}

async function forwardToOrchestrator(conn: any, jid: string, text: string, msg: any, orchestratorUrl: string): Promise<void> {
  console.log(`[WhatsApp] Forwarding to orchestrator: ${text.slice(0, 30)}...`)
  
  // Extraer message key para edición posterior
  const messageKey = msg.key
  
  try {
    const response = await fetch(`${orchestratorUrl}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jid, text, messageKey }),
    })
    
    const result = await response.json()
    
    if (result.success) {
      // Message was queued - NO enviar ack aquí
      // La respuesta se editará en el mensaje cuando llegue
    } else {
      await conn.sendMessage(jid, {
        text: `❌ Error: ${result.error || 'Unknown error'}`,
      }, { quoted: msg })
    }
  } catch (e) {
    console.error(`[WhatsApp] Orchestrator error: ${e}`)
    await conn.sendMessage(jid, {
      text: "❌ No se pudo conectar al orquestador",
    })
  }
}

export default { processMessage, handleMessage }