/**
 * WhatsApp Message Handlers
 *
 * Handles incoming messages and processes commands.
 * Supports /start, /help, /newgroup commands.
 */

import { jidToPhone } from "../session"

const PREFIX = "/"

const commands: Record<string, (conn: any, msg: any, args: string[]) => Promise<void>> = {
  async start(conn, msg, _args) {
    const jid = msg.key.remoteJid!
    await conn.sendMessage(jid, {
      text: `🤖 *OpenCode WhatsApp Bot*

¡Hola! Estoy listo para ayudarte con código.

Cada chat tiene su propia instancia de OpenCode.

*Comandos disponibles:*
• /start - Mostrar este mensaje
• /help - Ayuda detallada
• /newgroup - Crear nuevo grupo (en desarrollo)

*Estado:* 🟢 Conectado`,
    })
  },

  async help(conn, msg, _args) {
    const jid = msg.key.remoteJid!
    await conn.sendMessage(jid, {
      text: `📖 *Ayuda de OpenCode WhatsApp*

*Comandos:*
${PREFIX}start - Mensaje de bienvenida
${PREFIX}help - Esta ayuda
${PREFIX}newgroup <nombre> - Crear grupo nuevo

*Cómo funciona:*
• Cada tema/topic = instancia OpenCode separada
• Los mensajes se envían a OpenCode para procesar
• Recibes respuestas en tiempo real

*Notas:*
• Coming soon: Integración con OpenCode
• Los grupos se crean automáticamente`,
    })
  },

  async newgroup(conn, msg, _args) {
    const jid = msg.key.remoteJid!
    await conn.sendMessage(jid, {
      text: `🏠 *Crear Grupo*

Esta función está en desarrollo.

Por ahora puedes:
1. Crear grupo desde WhatsApp
2. Añadirme al grupo
3. Darme admin rights
4. Yo gestiono las instancias`,
    })
  },
}

export async function handleMessage(conn: any, msg: any): Promise<void> {
  const jid = msg.key.remoteJid!

  const messageText = getMessageText(msg)
  if (!messageText) return

  if (!messageText.startsWith(PREFIX)) {
    return
  }

  const [cmd, ...args] = messageText.slice(1).split(" ")
  const command = cmd.toLowerCase()

  const handler = commands[command]
  if (handler) {
    await handler(conn, msg, args)
  } else {
    await conn.sendMessage(jid, {
      text: `❓ Comando no reconocido: ${cmd}

Usa ${PREFIX}help para ver comandos disponibles.`,
    })
  }
}

function getMessageText(msg: any): string | null {
  const msgContent = msg.message

  if (!msgContent) return null

  if (msgContent.conversation) {
    return msgContent.conversation
  }

  if (msgContent.extendedTextMessage?.text) {
    return msgContent.extendedTextMessage.text
  }

  if (msgContent.imageMessage?.caption) {
    return msgContent.imageMessage.caption
  }

  return null
}

export default { handleMessage }