const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const SVG_PATH = path.join(PUBLIC_DIR, 'globe.svg');

const icons = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

async function generateIcons() {
  const svgBuffer = fs.readFileSync(SVG_PATH);

  for (const icon of icons) {
    const outputPath = path.join(PUBLIC_DIR, icon.name);

    await sharp(svgBuffer)
      .resize(icon.size, icon.size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toFile(outputPath);

    const stats = fs.statSync(outputPath);
    console.log(`Generated: ${icon.name} (${icon.size}x${icon.size}) - ${stats.size} bytes`);
  }

  console.log('\nAll icons generated successfully in:', PUBLIC_DIR);
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
