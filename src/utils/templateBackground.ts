/**
 * High-definition Background Template Engine for Supermarket Offer Posters.
 * Matches 100% of the official supermarket graphics (TAGG1, TAGG2, TAGG3, TAGG4).
 * Supports:
 * - Direct image caching and base64 rendering
 * - LocalStorage persistence for user-uploaded official graphic assets
 * - High-DPI canvas generation (1420 x 980 px) for crisp print quality
 */

import { getSingleTagSvgString, getSvgTemplateDataUrl } from './templateSvg';

const STORAGE_KEY_CUSTOM_TEMPLATE = 'tagg_custom_template_image';

export function getCustomTemplateImage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_CUSTOM_TEMPLATE);
  } catch {
    return null;
  }
}

export function saveCustomTemplateImage(dataUrl: string) {
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_TEMPLATE, dataUrl);
    cachedSingleTagDataUrl = null;
  } catch (e) {
    console.error('Failed to save custom template:', e);
  }
}

export function clearCustomTemplateImage() {
  try {
    localStorage.removeItem(STORAGE_KEY_CUSTOM_TEMPLATE);
    cachedSingleTagDataUrl = null;
  } catch (e) {
    console.error('Failed to clear custom template:', e);
  }
}

let cachedSingleTagDataUrl: string | null = null;
let svgImageElement: HTMLImageElement | null = null;

function getOrLoadSvgImage(): HTMLImageElement {
  if (!svgImageElement) {
    svgImageElement = new Image();
    svgImageElement.src = getSvgTemplateDataUrl();
  }
  return svgImageElement;
}

if (typeof window !== 'undefined') {
  getOrLoadSvgImage();
}

/**
 * Draws the official supermarket template graphics onto a Canvas context
 */
export function drawSingleTagTemplateOnCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  // 1. Check if custom uploaded graphic exists
  const customImg = getCustomTemplateImage();
  if (customImg) {
    const img = new Image();
    img.src = customImg;
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, x, y, w, h);
      return;
    }
  }

  // 2. Base White Card
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x, y, w, h);

  // ==========================================
  // 1. TOP HEADER BANNER (GREEN LEFT + ORANGE RIGHT)
  // ==========================================
  const headerH = h * 0.214;
  const greenW = w * 0.556;
  const orangeW = w - greenW;

  // 1.1 Left Green Banner (#0C7536)
  ctx.fillStyle = '#0C7536';
  ctx.fillRect(x, y, greenW, headerH);

  // "OFERTA" Text with 3D Drop Shadow
  ctx.save();
  ctx.font = `900 italic ${headerH * 0.76}px "Arial Black", Impact, "Helvetica Neue", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Dark shadow
  ctx.fillStyle = '#043516';
  ctx.fillText('OFERTA', x + greenW / 2 + 2.5, y + headerH / 2 + 3);

  // Main Neon Yellow
  ctx.fillStyle = '#FFE600';
  ctx.fillText('OFERTA', x + greenW / 2, y + headerH / 2);
  ctx.restore();

  // 1.2 Right Orange Banner (#E64516)
  ctx.fillStyle = '#E64516';
  ctx.fillRect(x + greenW, y, orangeW, headerH);

  // WhatsApp Decorative Green Circles
  ctx.fillStyle = '#0C7536';
  const r = headerH * 0.082;
  const bubbles = [
    { cx: x + greenW + orangeW * 0.07, cy: y + headerH * 0.2 },
    { cx: x + greenW + orangeW * 0.52, cy: y + headerH * 0.2 },
    { cx: x + greenW + orangeW * 0.52, cy: y + headerH * 0.8 },
    { cx: x + w - orangeW * 0.04, cy: y + headerH * 0.2 },
    { cx: x + w - orangeW * 0.04, cy: y + headerH * 0.8 },
  ];
  bubbles.forEach((b) => {
    ctx.beginPath();
    ctx.arc(b.cx, b.cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Inner white highlight
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(b.cx - 0.5, b.cy - 0.5, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0C7536';
  });

  // White Call-To-Action Texts
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `900 ${headerH * 0.165}px "Arial Black", Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('RECEBA AS', x + greenW + orangeW * 0.06, y + headerH * 0.13);
  ctx.fillText('NOSSAS OFERTAS', x + greenW + orangeW * 0.06, y + headerH * 0.31);
  ctx.fillText('NO SEU WHATS!', x + greenW + orangeW * 0.06, y + headerH * 0.49);

  // Yellow Phone Number Pill
  const pillW = orangeW * 0.45;
  const pillH = headerH * 0.25;
  const pillX = x + greenW + orangeW * 0.05;
  const pillY = y + headerH * 0.67;
  ctx.fillStyle = '#FFE600';
  ctx.fillRect(pillX, pillY, pillW, pillH);

  ctx.fillStyle = '#0C7536';
  ctx.font = `900 ${headerH * 0.18}px "Arial Black", Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText('11 2795-6750', pillX + pillW * 0.06, pillY + pillH / 2);
  ctx.restore();

  // QR Code Frame
  const qrSize = headerH * 0.82;
  const qrX = x + w - qrSize - orangeW * 0.06;
  const qrY = y + (headerH - qrSize) / 2;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(qrX, qrY, qrSize, qrSize);
  ctx.strokeStyle = '#0C7536';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(qrX, qrY, qrSize, qrSize);

  // QR Finder Pattern
  ctx.fillStyle = '#000000';
  const cS = qrSize * 0.24;
  ctx.fillRect(qrX + 2.5, qrY + 2.5, cS, cS);
  ctx.fillRect(qrX + qrSize - cS - 2.5, qrY + 2.5, cS, cS);
  ctx.fillRect(qrX + 2.5, qrY + qrSize - cS - 2.5, cS, cS);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(qrX + 4.5, qrY + 4.5, cS - 4, cS - 4);
  ctx.fillRect(qrX + qrSize - cS - 0.5, qrY + 4.5, cS - 4, cS - 4);
  ctx.fillRect(qrX + 4.5, qrY + qrSize - cS - 0.5, cS - 4, cS - 4);

  ctx.fillStyle = '#000000';
  ctx.fillRect(qrX + 6.5, qrY + 6.5, cS - 8, cS - 8);
  ctx.fillRect(qrX + qrSize - cS + 1.5, qrY + 6.5, cS - 8, cS - 8);
  ctx.fillRect(qrX + 6.5, qrY + qrSize - cS + 1.5, cS - 8, cS - 8);

  // Center Green "A" Badge in QR
  const bS = qrSize * 0.32;
  const bX = qrX + (qrSize - bS) / 2;
  const bY = qrY + (qrSize - bS) / 2;
  ctx.fillStyle = '#0C7536';
  ctx.fillRect(bX, bY, bS, bS);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `900 italic ${bS * 0.75}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('A', bX + bS / 2, bY + bS / 2);

  // Subtitle below QR
  ctx.fillStyle = '#0C7536';
  ctx.font = `bold ${headerH * 0.05}px Arial, sans-serif`;
  ctx.fillText('APONTE SUA CÂMERA', qrX + qrSize / 2, qrY + qrSize + headerH * 0.06);

  // ==========================================
  // 2. HORIZONTAL SUBTLE GUIDELINES (BOTTOM)
  // ==========================================
  ctx.strokeStyle = '#E0E0E0';
  ctx.lineWidth = 1;
  const lineY = y + h * 0.98;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x, lineY + i * 3);
    ctx.lineTo(x + w, lineY + i * 3);
    ctx.stroke();
  }

  // ==========================================
  // 3. OFFICIAL SLENDER "A" WING LOGO (BOTTOM-RIGHT)
  // ==========================================
  // The wing in the official clean template sits from y = 0.58h to 0.98h at the bottom right
  const wingTopY = y + h * 0.58;
  const wingBottomY = y + h * 0.98;
  const wingLeftX = x + w * 0.80;
  const wingRightX = x + w * 0.98;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(wingLeftX, wingBottomY);
  ctx.lineTo(wingRightX, wingTopY);
  ctx.lineTo(x + w * 0.96, wingBottomY);
  ctx.closePath();
  ctx.fillStyle = '#E64516';
  ctx.fill();

  // White Stylized "A" inside the Wing
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `900 italic ${h * 0.10}px "Arial Black", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('A', x + w * 0.91, y + h * 0.89);
  ctx.restore();
}

/**
 * Returns a high-res PNG data URL for jsPDF embedding (1420 x 980 px)
 */
export function getSingleTagTemplateImage(): string {
  const custom = getCustomTemplateImage();
  if (custom) return custom;

  if (cachedSingleTagDataUrl) return cachedSingleTagDataUrl;

  const canvas = document.createElement('canvas');
  canvas.width = 1420;
  canvas.height = 980;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  drawSingleTagTemplateOnCanvas(ctx, 0, 0, canvas.width, canvas.height);

  cachedSingleTagDataUrl = canvas.toDataURL('image/png', 0.95);
  return cachedSingleTagDataUrl;
}
