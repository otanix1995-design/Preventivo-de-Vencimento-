import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import {
  getTagg1SvgString,
  getTagg2SvgString,
  getTagg3SvgString,
  getTagg4SvgString,
  getSingleTagSvgString,
} from '../src/utils/templateSvg.js';

const publicTemplatesDir = path.resolve('public/templates');
const srcTemplatesDir = path.resolve('src/assets/templates');

if (!fs.existsSync(publicTemplatesDir)) {
  fs.mkdirSync(publicTemplatesDir, { recursive: true });
}
if (!fs.existsSync(srcTemplatesDir)) {
  fs.mkdirSync(srcTemplatesDir, { recursive: true });
}

async function renderAndSave(svgString: string, filename: string, width = 2970, height = 2100) {
  const svgBuffer = Buffer.from(svgString);

  // Save SVG
  fs.writeFileSync(path.join(publicTemplatesDir, `${filename}.svg`), svgBuffer);
  fs.writeFileSync(path.join(srcTemplatesDir, `${filename}.svg`), svgBuffer);

  // Render to high-res PNG (2970 x 2100 = 300 DPI for A4 landscape)
  const pngBuffer = await sharp(svgBuffer)
    .resize(width, height)
    .png({ quality: 100, compressionLevel: 6 })
    .toBuffer();

  fs.writeFileSync(path.join(publicTemplatesDir, `${filename}.png`), pngBuffer);
  fs.writeFileSync(path.join(srcTemplatesDir, `${filename}.png`), pngBuffer);

  // Also support user uploaded naming conventions as aliases
  if (filename === 'TAGG1_LIMPO') {
    fs.writeFileSync(path.join(publicTemplatesDir, `TAGG1_LIMPO-1.png`), pngBuffer);
  } else if (filename === 'TAGG2_LIMPO') {
    fs.writeFileSync(path.join(publicTemplatesDir, `TAGG2_LIMPO-2.png`), pngBuffer);
    fs.writeFileSync(path.join(publicTemplatesDir, `TAGG2_LIMPO-1.png`), pngBuffer);
  } else if (filename === 'TAGG3_LIMPO') {
    fs.writeFileSync(path.join(publicTemplatesDir, `TAGG3_LIMPO-1.png`), pngBuffer);
  } else if (filename === 'TAGG4_LIMPO') {
    fs.writeFileSync(path.join(publicTemplatesDir, `TAGG4_LIMPO-1.png`), pngBuffer);
  }

  console.log(`Generated ${filename}.png (${width}x${height}) successfully`);
}

async function main() {
  await renderAndSave(getTagg1SvgString(), 'TAGG1_LIMPO', 2970, 2100);
  await renderAndSave(getTagg2SvgString(), 'TAGG2_LIMPO', 2970, 2100);
  await renderAndSave(getTagg3SvgString(), 'TAGG3_LIMPO', 2970, 2100);
  await renderAndSave(getTagg4SvgString(), 'TAGG4_LIMPO', 2970, 2100);
  await renderAndSave(getSingleTagSvgString(), 'SINGLE_TAG', 1400, 970);
  console.log('All static PNG templates generated successfully!');
}

main().catch((err) => {
  console.error('Error generating templates:', err);
  process.exit(1);
});
