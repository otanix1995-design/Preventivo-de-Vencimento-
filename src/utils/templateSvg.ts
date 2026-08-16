/**
 * SVG Vector Templates for TAGG Offer Posters (Single tag & 4-up A4 sheet)
 * Exactly reproduces the official supermarket graphic artwork from the original clean PDF.
 */

export function getSingleTagSvgString(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1420 980" width="1420" height="980">
  <defs>
    <!-- Dark green shadow for OFERTA text -->
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="3" dy="4" stdDeviation="0" flood-color="#043818" flood-opacity="1" />
    </filter>
  </defs>

  <!-- Base Card Background -->
  <rect x="0" y="0" width="1420" height="980" fill="#FFFFFF"/>

  <!-- ========================================== -->
  <!-- 1. TOP BANNER (GREEN LEFT + ORANGE RIGHT)  -->
  <!-- ========================================== -->
  <!-- 1.1 Left Green Banner -->
  <rect x="0" y="0" width="790" height="210" fill="#0C7536"/>

  <!-- OFERTA Text -->
  <text x="395" y="155" 
        text-anchor="middle" 
        fill="#FFE600" 
        filter="url(#shadow)"
        font-family="'Arial Black', Impact, 'Helvetica Neue', sans-serif" 
        font-size="160" 
        font-weight="900" 
        font-style="italic" 
        letter-spacing="-3">OFERTA</text>

  <!-- 1.2 Right Orange Banner -->
  <rect x="790" y="0" width="630" height="210" fill="#E64516"/>

  <!-- WhatsApp decorative green bubbles -->
  <circle cx="830" cy="40" r="16" fill="#0C7536"/>
  <circle cx="828" cy="38" r="8" fill="#FFFFFF" opacity="0.9"/>

  <circle cx="1115" cy="42" r="16" fill="#0C7536"/>
  <circle cx="1113" cy="40" r="8" fill="#FFFFFF" opacity="0.9"/>

  <circle cx="1115" cy="168" r="16" fill="#0C7536"/>
  <circle cx="1113" cy="166" r="8" fill="#FFFFFF" opacity="0.9"/>

  <circle cx="1385" cy="40" r="16" fill="#0C7536"/>
  <circle cx="1383" cy="38" r="8" fill="#FFFFFF" opacity="0.9"/>

  <circle cx="1385" cy="168" r="16" fill="#0C7536"/>
  <circle cx="1383" cy="166" r="8" fill="#FFFFFF" opacity="0.9"/>

  <!-- WhatsApp Call-to-action Texts -->
  <text x="825" y="52" fill="#FFFFFF" font-family="'Arial Black', Arial, sans-serif" font-size="34" font-weight="900" letter-spacing="-0.5">RECEBA AS</text>
  <text x="825" y="89" fill="#FFFFFF" font-family="'Arial Black', Arial, sans-serif" font-size="34" font-weight="900" letter-spacing="-0.5">NOSSAS OFERTAS</text>
  <text x="825" y="126" fill="#FFFFFF" font-family="'Arial Black', Arial, sans-serif" font-size="34" font-weight="900" letter-spacing="-0.5">NO SEU WHATS!</text>

  <!-- Yellow WhatsApp Phone Pill -->
  <rect x="825" y="142" width="280" height="52" rx="4" fill="#FFE600"/>
  <text x="965" y="180" text-anchor="middle" fill="#0C7536" font-family="'Arial Black', Arial, sans-serif" font-size="38" font-weight="900">11 2795-6750</text>

  <!-- QR Code Frame & Structure -->
  <g transform="translate(1170, 18)">
    <!-- White QR base with green stroke -->
    <rect x="0" y="0" width="170" height="170" rx="4" fill="#FFFFFF" stroke="#0C7536" stroke-width="4"/>

    <!-- QR finder pattern: Top-Left -->
    <rect x="14" y="14" width="40" height="40" fill="#000000"/>
    <rect x="22" y="22" width="24" height="24" fill="#FFFFFF"/>
    <rect x="28" y="28" width="12" height="12" fill="#000000"/>

    <!-- QR finder pattern: Top-Right -->
    <rect x="116" y="14" width="40" height="40" fill="#000000"/>
    <rect x="124" y="22" width="24" height="24" fill="#FFFFFF"/>
    <rect x="130" y="28" width="12" height="12" fill="#000000"/>

    <!-- QR finder pattern: Bottom-Left -->
    <rect x="14" y="116" width="40" height="40" fill="#000000"/>
    <rect x="22" y="124" width="24" height="24" fill="#FFFFFF"/>
    <rect x="28" y="130" width="12" height="12" fill="#000000"/>

    <!-- QR Data Dots -->
    <rect x="62" y="18" width="10" height="10" fill="#000000"/>
    <rect x="78" y="18" width="10" height="10" fill="#000000"/>
    <rect x="94" y="18" width="10" height="10" fill="#000000"/>
    <rect x="62" y="34" width="10" height="10" fill="#000000"/>
    <rect x="94" y="34" width="10" height="10" fill="#000000"/>
    <rect x="18" y="62" width="10" height="10" fill="#000000"/>
    <rect x="34" y="62" width="10" height="10" fill="#000000"/>
    <rect x="122" y="62" width="10" height="10" fill="#000000"/>
    <rect x="142" y="62" width="10" height="10" fill="#000000"/>
    <rect x="18" y="94" width="10" height="10" fill="#000000"/>
    <rect x="42" y="94" width="10" height="10" fill="#000000"/>
    <rect x="118" y="94" width="10" height="10" fill="#000000"/>
    <rect x="138" y="94" width="10" height="10" fill="#000000"/>
    <rect x="62" y="122" width="10" height="10" fill="#000000"/>
    <rect x="78" y="122" width="10" height="10" fill="#000000"/>
    <rect x="94" y="122" width="10" height="10" fill="#000000"/>
    <rect x="62" y="142" width="10" height="10" fill="#000000"/>
    <rect x="94" y="142" width="10" height="10" fill="#000000"/>

    <!-- Green Center Badge with white 'A' -->
    <rect x="60" y="60" width="50" height="50" rx="4" fill="#0C7536"/>
    <text x="85" y="98" text-anchor="middle" fill="#FFFFFF" font-family="'Arial Black', Arial, sans-serif" font-size="40" font-weight="900" font-style="italic">A</text>

    <!-- Subtitle below QR -->
    <text x="85" y="182" text-anchor="middle" fill="#0C7536" font-family="Arial, sans-serif" font-size="10" font-weight="bold">APONTE SUA CÂMERA</text>
  </g>

  <!-- ========================================== -->
  <!-- 2. HORIZONTAL BOTTOM GUIDELINES            -->
  <!-- ========================================== -->
  <g stroke="#E0E0E0" stroke-width="2">
    <line x1="0" y1="960" x2="1420" y2="960" />
    <line x1="0" y1="968" x2="1420" y2="968" />
    <line x1="0" y1="976" x2="1420" y2="976" />
  </g>

  <!-- ========================================== -->
  <!-- 3. OFFICIAL SLENDER "A" WING LOGO (BOTTOM RIGHT) -->
  <!-- ========================================== -->
  <!-- Wing polygon: Starts at x=1140 (bottom) and angles up to x=1390 (top) -->
  <g transform="translate(0, 0)">
    <polygon points="1140,960 1390,560 1365,960" fill="#E64516" />

    <!-- White stylized "A" inside the wing -->
    <text x="1290" y="870" 
          text-anchor="middle" 
          fill="#FFFFFF" 
          font-family="'Arial Black', Impact, sans-serif" 
          font-size="96" 
          font-weight="900" 
          font-style="italic">A</text>
  </g>
</svg>`;
}

let cachedSvgDataUrl: string | null = null;

export function getSvgTemplateDataUrl(): string {
  if (cachedSvgDataUrl) return cachedSvgDataUrl;
  const svg = getSingleTagSvgString();
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  cachedSvgDataUrl = `data:image/svg+xml;base64,${base64}`;
  return cachedSvgDataUrl;
}
