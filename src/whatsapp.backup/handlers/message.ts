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
export async function handleMessage(conn: any, msg: any): Promise<void> {
  const processed = processMessage(msg)
  
  // Only process commands
  if (!processed.isCommand) {
    return
  }
  
  console.log(`[WhatsApp] Command: /${processed.command} from ${processed.from}`)
  
  // Process command
  switch (processed.command) {
    case "start":
      await conn.sendMessage(processed.from, {
        text: "✅ *WhatsApp Bot Active*\n\n" +
           "Commands:\n" +
           "• /help - Show help\n" +
           "• /newgroup <name> - Create group\n" +
           "• /ping - Test connection",
      }, { quoted: msg })
      break
      
    case "help":
      await conn.sendMessage(processed.from, {
        text: "📚 *WhatsApp Commands*\n\n" +
           "• /start - Start bot\n" +
           "• /help - Show this help\n" +
           "• /ping - Test connection\n" +
           "• /newgroup <name> - Create group\n" +
           "• /group <jid> - Get group info\n\n" +
           "_Powered by Baileys_",
      }, { quoted: msg })
      break
      
    case "ping":
      await conn.sendMessage(processed.from, {
        text: "🏓 Pong!",
      }, { quoted: msg })
      break
      
    case "newgroup":
      // Note: Group creation requires more participants
      await conn.sendMessage(processed.from, {
        text: "📝 To create a group, use:\n" +
           "/newgroup <name> <phone1> <phone2> ...",
      }, { quoted: msg })
      break
      
    case "group":
      if (processed.args[0]) {
        try {
          const metadata = await conn.groupMetadata(processed.args[0])
          await conn.sendMessage(processed.from, {
            text: `📋 *Group Info*\n\n` +
               `• Name: ${metadata.subject}\n` +
               `• Members: ${metadata.participants.length}\n` +
               `• Created: ${new Date(metadata.creation * 1000).toLocaleString()}`,
          }, { quoted: msg })
        } catch (e) {
          await conn.sendMessage(processed.from, {
            text: "❌ Could not get group info",
          }, { quoted: msg })
        }
      } else {
        await conn.sendMessage(processed.from, {
          text: "Usage: /group <group_jid>",
        }, { quoted: msg })
      }
      break
      
    default:
      await conn.sendMessage(processed.from, {
        text: "❓ Unknown command. Use /help for available commands.",
      }, { quoted: msg })
  }
}

export default { processMessage, handleMessage }