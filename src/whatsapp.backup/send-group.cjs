const { createRequire } = require('module')
const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')

async function main() {
  const { state, saveCreds } = await useMultiFileAuthState('./data/whatsapp/default')
  const conn = makeWASocket({ auth: state, printQRInTerminal: false })

  conn.ev.on('creds.update', saveCreds)
  conn.ev.on('connection.update', ({ connection }) => {
    if (connection === 'open') {
      const groupJid = '120363427936434343@g.us'
      conn.sendMessage(groupJid, { text: '🎉 ¡Hola! El bot de OpenCode está funcionando en el grupo!' })
        .then(r => console.log('✅ Enviado:', r.key.id))
        .catch(e => console.log('❌ Error:', e.message))
        .finally(() => process.exit(0))
    }
  })
}

main()