// Script to generate the high-definition authentic template PNG assets
import fs from 'fs';
import path from 'path';
import { getTagg1SvgString, getTagg2SvgString, getTagg3SvgString, getTagg4SvgString, getSingleTagSvgString } from './src/utils/templateSvg.js';

// If svg cannot be directly converted in node without canvas, let's create the SVG files as well
const publicTemplatesDir = path.resolve('public/templates');
const srcTemplatesDir = path.resolve('src/assets/templates');

if (!fs.existsSync(publicTemplatesDir)) {
  fs.mkdirSync(publicTemplatesDir, { recursive: true });
}
if (!fs.existsSync(srcTemplatesDir)) {
  fs.mkdirSync(srcTemplatesDir, { recursive: true });
}

fs.writeFileSync(path.join(publicTemplatesDir, 'TAGG1_LIMPO.svg'), getTagg1SvgString());
fs.writeFileSync(path.join(publicTemplatesDir, 'TAGG2_LIMPO.svg'), getTagg2SvgString());
fs.writeFileSync(path.join(publicTemplatesDir, 'TAGG3_LIMPO.svg'), getTagg3SvgString());
fs.writeFileSync(path.join(publicTemplatesDir, 'TAGG4_LIMPO.svg'), getTagg4SvgString());
fs.writeFileSync(path.join(publicTemplatesDir, 'SINGLE_TAG.svg'), getSingleTagSvgString());

console.log('SVG templates written successfully to public/templates/');
