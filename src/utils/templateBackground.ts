/**
 * Static PNG Templates for Official Supermarket Offer Posters (TAGG)
 * Assets: TAGG1_LIMPO.png, TAGG2_LIMPO.png, TAGG3_LIMPO.png, TAGG4_LIMPO.png
 * 
 * Rules:
 * - 100% fixed immutable PNG backgrounds.
 * - ZERO redrawing of header, QR, green banner, orange block, guidelines or wing logos.
 * - Dynamic product variables are strictly overlaid onto fixed millimeter coordinates.
 */

import { getSvgTemplateDataUrl } from './templateSvg';

export type TemplateKey = 'TAGG1_LIMPO' | 'TAGG2_LIMPO' | 'TAGG3_LIMPO' | 'TAGG4_LIMPO';

export const TEMPLATE_PNG_PATHS: Record<TemplateKey, string> = {
  TAGG1_LIMPO: '/templates/TAGG1_LIMPO.png',
  TAGG2_LIMPO: '/templates/TAGG2_LIMPO.png',
  TAGG3_LIMPO: '/templates/TAGG3_LIMPO.png',
  TAGG4_LIMPO: '/templates/TAGG4_LIMPO.png',
};

const STORAGE_PREFIX = 'tagg_template_file_';

export function getCustomTemplateImage(key: TemplateKey = 'TAGG4_LIMPO'): string | null {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${key}`) || null;
  } catch {
    return null;
  }
}

export function saveCustomTemplateImage(keyOrDataUrl: string, maybeDataUrl?: string) {
  try {
    let key: TemplateKey = 'TAGG4_LIMPO';
    let dataUrl = keyOrDataUrl;
    if (maybeDataUrl) {
      key = keyOrDataUrl as TemplateKey;
      dataUrl = maybeDataUrl;
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, dataUrl);
    }
    localStorage.setItem('tagg_custom_template_image', dataUrl);
    const keys: TemplateKey[] = ['TAGG1_LIMPO', 'TAGG2_LIMPO', 'TAGG3_LIMPO', 'TAGG4_LIMPO'];
    keys.forEach((k) => delete cachedPngTemplates[k]);
  } catch (e) {
    console.error('Failed to save custom template:', e);
  }
}

export function clearCustomTemplateImage(key?: TemplateKey) {
  try {
    if (key) {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      delete cachedPngTemplates[key];
    } else {
      const keys: TemplateKey[] = ['TAGG1_LIMPO', 'TAGG2_LIMPO', 'TAGG3_LIMPO', 'TAGG4_LIMPO'];
      keys.forEach((k) => {
        localStorage.removeItem(`${STORAGE_PREFIX}${k}`);
        delete cachedPngTemplates[k];
      });
      localStorage.removeItem('tagg_custom_template_image');
    }
  } catch (e) {
    console.error('Failed to clear custom template:', e);
  }
}

const cachedPngTemplates: Partial<Record<TemplateKey | 'SINGLE_TAG', string>> = {};

/**
 * Loads and caches the official PNG template in high resolution (2970x2100).
 */
export async function getTemplatePngDataUrl(key: TemplateKey = 'TAGG4_LIMPO'): Promise<string> {
  // 1. Check custom uploaded template
  const custom = getCustomTemplateImage(key);
  if (custom) {
    return custom;
  }

  // 2. Check memory cache
  if (cachedPngTemplates[key]) {
    return cachedPngTemplates[key]!;
  }

  // 3. Try to fetch from static PNG path if available
  const staticPath = TEMPLATE_PNG_PATHS[key];
  if (typeof window !== 'undefined') {
    try {
      const resp = await fetch(staticPath);
      if (resp.ok) {
        const blob = await resp.blob();
        const base64 = await blobToBase64(blob);
        cachedPngTemplates[key] = base64;
        return base64;
      }
    } catch {
      // Fallback to rasterizing high-res SVG if static file is loading in development
    }
  }

  // 4. Fallback: High-resolution rasterization to PNG
  const svgDataUrl = getSvgTemplateDataUrl(key);
  const pngDataUrl = await rasterizeToPng(svgDataUrl, 2970, 2100);
  cachedPngTemplates[key] = pngDataUrl;
  return pngDataUrl;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function rasterizeToPng(dataUrl: string, width = 2970, height = 2100): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const png = canvas.toDataURL('image/png', 1.0);
        resolve(png);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Returns image data URL for preview in UI
 */
export function getTemplateImage(key: TemplateKey | 'SINGLE_TAG' = 'TAGG4_LIMPO'): string {
  if (key !== 'SINGLE_TAG') {
    const custom = getCustomTemplateImage(key);
    if (custom) return custom;
  }
  if (cachedPngTemplates[key]) {
    return cachedPngTemplates[key]!;
  }
  return getSvgTemplateDataUrl(key === 'SINGLE_TAG' ? 'SINGLE_TAG' : key);
}

export function getSingleTagTemplateImage(): string {
  return getTemplateImage('SINGLE_TAG');
}
