const QRCode = require("qrcode")

async function test() {
  // Generate simple ASCII QR without colors
  const qrText = await QRCode.toString("https://example.com", {
    type: "utf8",
    small: false
  })
  console.log("\n📱 QR Simple (UTF8):\n")
  console.log(qrText)
  
  // Check the image was saved too
  const fs = require("fs")
  if (fs.existsSync("./test-qr.png")) {
    const stats = fs.statSync("./test-qr.png")
    console.log(`\n✅ QR image exists: ${stats.size} bytes\n`)
  }
}

test()