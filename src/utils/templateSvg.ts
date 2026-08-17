/**
 * SVG Vector Templates for Official TAGG Supermarket Offer Posters
 * Pixel-perfect representation of official TAGG1, TAGG2, TAGG3, TAGG4 templates.
 */

export function getSingleTagSvgContent(w = 1400, h = 970): string {
  const headerH = 226;
  const greenW = 830;
  const orangeW = w - greenW; // 570

  return `
    <!-- 1.1 Left Green Banner -->
    <rect x="0" y="0" width="${greenW}" height="${headerH}" fill="#0C7536"/>

    <!-- OFERTA Text with 3D drop shadow -->
    <text x="${greenW / 2}" y="${headerH * 0.73}" 
          text-anchor="middle" 
          fill="#043818" 
          font-family="'Arial Black', Impact, 'Helvetica Neue', sans-serif" 
          font-size="160" 
          font-weight="900" 
          font-style="italic" 
          letter-spacing="-4"
          transform="translate(4, 5)">OFERTA</text>
    <text x="${greenW / 2}" y="${headerH * 0.73}" 
          text-anchor="middle" 
          fill="#FFE600" 
          font-family="'Arial Black', Impact, 'Helvetica Neue', sans-serif" 
          font-size="160" 
          font-weight="900" 
          font-style="italic" 
          letter-spacing="-4">OFERTA</text>

    <!-- 1.2 Right Orange Banner -->
    <rect x="${greenW}" y="0" width="${orangeW}" height="${headerH}" fill="#E84615"/>

    <!-- WhatsApp green bubbles with phone icon -->
    <g fill="#0C7536">
      <circle cx="${greenW + 28}" cy="42" r="18"/>
      <circle cx="${greenW + 28}" cy="180" r="18"/>
      <circle cx="${greenW + 300}" cy="42" r="18"/>
      <circle cx="${greenW + 300}" cy="180" r="18"/>
      <circle cx="${greenW + 540}" cy="42" r="18"/>
      <circle cx="${greenW + 540}" cy="180" r="18"/>
    </g>
    <g fill="#FFFFFF">
      <path d="M ${greenW + 22} 38 Q ${greenW + 28} 34 ${greenW + 34} 38 Q ${greenW + 32} 44 ${greenW + 28} 48 Z" opacity="0.9"/>
      <path d="M ${greenW + 294} 38 Q ${greenW + 300} 34 ${greenW + 306} 38 Q ${greenW + 304} 44 ${greenW + 300} 48 Z" opacity="0.9"/>
      <path d="M ${greenW + 534} 38 Q ${greenW + 540} 34 ${greenW + 546} 38 Q ${greenW + 544} 44 ${greenW + 540} 48 Z" opacity="0.9"/>
    </g>

    <!-- WhatsApp Call-to-action Texts -->
    <text x="${greenW + 48}" y="56" fill="#FFFFFF" font-family="'Arial Black', Arial, sans-serif" font-size="28" font-weight="900" letter-spacing="-0.5">RECEBA AS</text>
    <text x="${greenW + 48}" y="98" fill="#FFFFFF" font-family="'Arial Black', Arial, sans-serif" font-size="28" font-weight="900" letter-spacing="-0.5">NOSSAS OFERTAS</text>
    <text x="${greenW + 48}" y="140" fill="#FFFFFF" font-family="'Arial Black', Arial, sans-serif" font-size="28" font-weight="900" letter-spacing="-0.5">NO SEU WHATS!</text>

    <!-- Yellow WhatsApp Phone Pill -->
    <rect x="${greenW + 48}" y="156" width="230" height="52" rx="6" fill="#FFE600"/>
    <text x="${greenW + 163}" y="193" text-anchor="middle" fill="#0C7536" font-family="'Arial Black', Arial, sans-serif" font-size="34" font-weight="900" letter-spacing="-1">11 2795-6750</text>

    <!-- QR Code Section -->
    <g transform="translate(${greenW + 340}, 20)">
      <!-- White QR Frame -->
      <rect x="0" y="0" width="186" height="186" rx="6" fill="#FFFFFF" stroke="#0C7536" stroke-width="4"/>

      <!-- Finder patterns -->
      <rect x="12" y="12" width="44" height="44" fill="#000000"/>
      <rect x="20" y="20" width="28" height="28" fill="#FFFFFF"/>
      <rect x="26" y="26" width="16" height="16" fill="#000000"/>

      <rect x="130" y="12" width="44" height="44" fill="#000000"/>
      <rect x="138" y="20" width="28" height="28" fill="#FFFFFF"/>
      <rect x="144" y="26" width="16" height="16" fill="#000000"/>

      <rect x="12" y="130" width="44" height="44" fill="#000000"/>
      <rect x="20" y="138" width="28" height="28" fill="#FFFFFF"/>
      <rect x="26" y="144" width="16" height="16" fill="#000000"/>

      <!-- QR Pattern modules -->
      <rect x="64" y="14" width="12" height="12" fill="#000000"/>
      <rect x="84" y="14" width="12" height="12" fill="#000000"/>
      <rect x="104" y="14" width="12" height="12" fill="#000000"/>
      <rect x="64" y="34" width="12" height="12" fill="#000000"/>
      <rect x="104" y="34" width="12" height="12" fill="#000000"/>
      <rect x="14" y="64" width="12" height="12" fill="#000000"/>
      <rect x="34" y="64" width="12" height="12" fill="#000000"/>
      <rect x="140" y="64" width="12" height="12" fill="#000000"/>
      <rect x="160" y="64" width="12" height="12" fill="#000000"/>
      <rect x="64" y="140" width="12" height="12" fill="#000000"/>
      <rect x="84" y="140" width="12" height="12" fill="#000000"/>
      <rect x="104" y="140" width="12" height="12" fill="#000000"/>
      <rect x="64" y="160" width="12" height="12" fill="#000000"/>
      <rect x="104" y="160" width="12" height="12" fill="#000000"/>

      <!-- Center Green Badge with 'A' -->
      <rect x="63" y="63" width="60" height="60" rx="6" fill="#0C7536"/>
      <text x="93" y="108" text-anchor="middle" fill="#FFFFFF" font-family="'Arial Black', Arial, sans-serif" font-size="44" font-weight="900" font-style="italic">A</text>

      <!-- Label below QR -->
      <text x="93" y="200" text-anchor="middle" fill="#0C7536" font-family="'Arial Black', Arial, sans-serif" font-size="9" font-weight="bold">APONTE SUA CÂMERA PARA O QRCODE</text>
    </g>

    <!-- 2. Horizontal Divider Lines & Wing Badge -->
    <g>
      <!-- 4 Fine gray horizontal lines -->
      <line x1="0" y1="${h * 0.96}" x2="${w * 0.88}" y2="${h * 0.96}" stroke="#D5D5D5" stroke-width="2"/>
      <line x1="0" y1="${h * 0.968}" x2="${w * 0.88}" y2="${h * 0.968}" stroke="#D5D5D5" stroke-width="2"/>
      <line x1="0" y1="${h * 0.976}" x2="${w * 0.88}" y2="${h * 0.976}" stroke="#D5D5D5" stroke-width="2"/>
      <line x1="0" y1="${h * 0.984}" x2="${w * 0.88}" y2="${h * 0.984}" stroke="#D5D5D5" stroke-width="2"/>

      <!-- Orange Wing Badge -->
      <polygon points="${w * 0.87},${h * 1.0} ${w * 1.0},${h * 0.63} ${w * 1.0},${h * 1.0}" fill="#E84615"/>
      <!-- Striped 'A' logo inside wing -->
      <text x="${w * 0.945}" y="${h * 0.92}" 
            text-anchor="middle" 
            fill="#FFFFFF" 
            font-family="'Arial Black', Impact, sans-serif" 
            font-size="90" 
            font-weight="900" 
            font-style="italic">A</text>
      <!-- Cutout stripes in 'A' -->
      <line x1="${w * 0.90}" y1="${h * 0.88}" x2="${w * 0.99}" y2="${h * 0.88}" stroke="#E84615" stroke-width="4"/>
      <line x1="${w * 0.90}" y1="${h * 0.92}" x2="${w * 0.99}" y2="${h * 0.92}" stroke="#E84615" stroke-width="4"/>
    </g>
  `;
}

/**
 * TAGG1_LIMPO: 1 cartaz at Top-Left (Slot 0) on A4 Landscape (2970 x 2100)
 */
export function getTagg1SvgString(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2970 2100" width="2970" height="2100">
    <rect x="0" y="0" width="2970" height="2100" fill="#FFFFFF"/>

    <!-- Slot 0: Top-Left (50, 50, 1400, 970) -->
    <g transform="translate(50, 50)">
      ${getSingleTagSvgContent(1400, 970)}
    </g>
  </svg>`;
}

/**
 * TAGG2_LIMPO: 2 cartazes at Top-Left and Top-Right on A4 Landscape (2970 x 2100)
 */
export function getTagg2SvgString(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2970 2100" width="2970" height="2100">
    <rect x="0" y="0" width="2970" height="2100" fill="#FFFFFF"/>

    <!-- Slot 0: Top-Left (50, 50, 1400, 970) -->
    <g transform="translate(50, 50)">
      ${getSingleTagSvgContent(1400, 970)}
    </g>

    <!-- Slot 1: Top-Right (1520, 50, 1400, 970) -->
    <g transform="translate(1520, 50)">
      ${getSingleTagSvgContent(1400, 970)}
    </g>
  </svg>`;
}

/**
 * TAGG3_LIMPO: 3 cartazes at Top-Left, Top-Right, and Bottom-Left on A4 Landscape (2970 x 2100)
 */
export function getTagg3SvgString(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2970 2100" width="2970" height="2100">
    <rect x="0" y="0" width="2970" height="2100" fill="#FFFFFF"/>

    <!-- Slot 0: Top-Left (50, 50, 1400, 970) -->
    <g transform="translate(50, 50)">
      ${getSingleTagSvgContent(1400, 970)}
    </g>

    <!-- Slot 1: Top-Right (1520, 50, 1400, 970) -->
    <g transform="translate(1520, 50)">
      ${getSingleTagSvgContent(1400, 970)}
    </g>

    <!-- Slot 2: Bottom-Left (50, 1080, 1400, 970) -->
    <g transform="translate(50, 1080)">
      ${getSingleTagSvgContent(1400, 970)}
    </g>
  </svg>`;
}

/**
 * TAGG4_LIMPO: 4 cartazes per page (2x2 grid on A4 Landscape 2970 x 2100)
 */
export function getTagg4SvgString(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2970 2100" width="2970" height="2100">
    <rect x="0" y="0" width="2970" height="2100" fill="#FFFFFF"/>

    <!-- Slot 0: Top-Left (50, 50, 1400, 970) -->
    <g transform="translate(50, 50)">
      ${getSingleTagSvgContent(1400, 970)}
    </g>

    <!-- Slot 1: Top-Right (1520, 50, 1400, 970) -->
    <g transform="translate(1520, 50)">
      ${getSingleTagSvgContent(1400, 970)}
    </g>

    <!-- Slot 2: Bottom-Left (50, 1080, 1400, 970) -->
    <g transform="translate(50, 1080)">
      ${getSingleTagSvgContent(1400, 970)}
    </g>

    <!-- Slot 3: Bottom-Right (1520, 1080, 1400, 970) -->
    <g transform="translate(1520, 1080)">
      ${getSingleTagSvgContent(1400, 970)}
    </g>
  </svg>`;
}

export function getSingleTagSvgString(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 970" width="1400" height="970">
    <rect x="0" y="0" width="1400" height="970" fill="#FFFFFF"/>
    ${getSingleTagSvgContent(1400, 970)}
  </svg>`;
}

const cachedDataUrls: Record<string, string> = {};

export function getSvgTemplateDataUrl(
  key: 'TAGG1_LIMPO' | 'TAGG2_LIMPO' | 'TAGG3_LIMPO' | 'TAGG4_LIMPO' | 'SINGLE_TAG' = 'TAGG4_LIMPO'
): string {
  if (cachedDataUrls[key]) return cachedDataUrls[key];

  let svg = '';
  switch (key) {
    case 'TAGG1_LIMPO':
      svg = getTagg1SvgString();
      break;
    case 'TAGG2_LIMPO':
      svg = getTagg2SvgString();
      break;
    case 'TAGG3_LIMPO':
      svg = getTagg3SvgString();
      break;
    case 'TAGG4_LIMPO':
      svg = getTagg4SvgString();
      break;
    case 'SINGLE_TAG':
    default:
      svg = getSingleTagSvgString();
      break;
  }

  const base64 = btoa(unescape(encodeURIComponent(svg)));
  const dataUrl = `data:image/svg+xml;base64,${base64}`;
  cachedDataUrls[key] = dataUrl;
  return dataUrl;
}
