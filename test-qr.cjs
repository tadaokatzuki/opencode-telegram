const QRCode = require("qrcode")
const fs = require("fs")
const path = require("path")

async function test() {
  const testUrl = "https://example.com"
  
  // Generate QR as terminal ASCII
  console.log("\n📱 QR Code Test (ASCII):\n")
  QRCode.toString(testUrl, { type: "terminal", small: false }, (err, url) => {
    if (err) {
      console.error("Error:", err)
      return
    }
    console.log(url)
  })
  
  // Generate QR as image
  const outputPath = "./test-qr.png"
  await QRCode.toDataURL(testUrl, {
    width: 300,
    margin: 2,
    color: { dark: "#000000", light: "#FFFFFF" }
  })
  .then(dataUrl => {
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "")
    fs.writeFileSync(outputPath, Buffer.from(base64, "base64"))
    console.log(`\n✅ QR image saved: ${path.resolve(outputPath)}`)
  })
  .catch(err => {
    console.error("Image error:", err)
  })
}

test()