import type { TipoControle } from '../types';

export interface InterpretacaoEmbalagem {
  tipoControle: TipoControle;
  multiplicadorTotal: number; // e.g. 72 for CXA 6 X 12 X 85G, 1 for UND, 1 for GR 1 X 1 X 1G
  unidadesPorPacote: number;
  seguro: boolean;
  motivo?: string;
}

export interface NormalizacaoVendaResult {
  qtdOriginal: number;
  qtdNormalizada: number;
  unidadeNormalizada: string; // "unidades" | "gramas" | "indefinido"
  tipoControle: TipoControle;
  seguro: boolean;
  motivo?: string;
}

/**
 * Interprets the packaging string from the sales report (SASOI061.xlsx) or product catalog.
 * Handles single multipliers, multi-factor multipliers, and weight packaging.
 *
 * Examples:
 * - "GR 1 X 1 X 1G" -> PESO, factor 1, safe
 * - "KG 1 X 1000 X 1G" -> PESO, factor 1, safe
 * - "UND 1 X 1 X 200G" -> UNIDADE, factor 1, safe
 * - "CXA 1 X 27 X 200G" -> UNIDADE, factor 27, safe
 * - "CXA 6 X 12 X 85G" -> UNIDADE, factor 72 (6 * 12), safe
 * - "FDO 10 X 16 X 40G" -> UNIDADE, factor 160 (10 * 16), safe
 * - "PCT 1 X 6 X 275ML" -> UNIDADE, factor 6, safe
 * - "CXA 1 X 24 X 275ML" -> UNIDADE, factor 24, safe
 * - "UND 1 X 1 X 1L" -> UNIDADE, factor 1, safe
 * - "CXA 1 X 12 X 1L" -> UNIDADE, factor 12, safe
 */
export function interpretarEmbalagemVenda(embalagemRaw: string): InterpretacaoEmbalagem {
  if (!embalagemRaw || typeof embalagemRaw !== 'string' || !embalagemRaw.trim()) {
    return {
      tipoControle: 'NAO_IDENTIFICADO',
      multiplicadorTotal: 1,
      unidadesPorPacote: 1,
      seguro: false,
      motivo: 'EMBALAGEM NÃO INFORMADA OU VAZIA',
    };
  }

  const rawUpper = embalagemRaw.toUpperCase().trim();

  // 1. Check for pure WEIGHT packaging:
  // e.g. "GR 1 X 1 X 1G", "GR 1X1X1G", "KG 1 X 1000 X 1G", "KG", "GR", "KILO"
  const isWeightOnly =
    (rawUpper.startsWith('GR ') || rawUpper.startsWith('KG ') || rawUpper === 'GR' || rawUpper === 'KG' || rawUpper.startsWith('KILO')) &&
    !rawUpper.includes('CX') &&
    !rawUpper.includes('UND') &&
    !rawUpper.includes('UN') &&
    !rawUpper.includes('PCT') &&
    !rawUpper.includes('FDO') &&
    !rawUpper.includes('FARDO') &&
    !rawUpper.includes('BDJ');

  if (isWeightOnly) {
    return {
      tipoControle: 'PESO',
      multiplicadorTotal: 1,
      unidadesPorPacote: 1,
      seguro: true,
    };
  }

  // 2. Unit based packages (CXA, UND, UN, PCT, FDO, FARDO, BDJ, LT, POTE, PT, AMP, CJ, KIT, SAC, etc.)
  // Handle multi-factor chains e.g. "CXA 6 X 12 X 85G", "CXA 1 X 27 X 200G", "FDO 10 X 16 X 40G", "PCT 1 X 6 X 275ML"
  if (rawUpper.includes('X')) {
    // Split by 'X'
    const parts = rawUpper.split(/\s*X\s*/);

    if (parts.length >= 2) {
      const multipliers: number[] = [];
      let recognizedFormat = true;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        const isLast = i === parts.length - 1;

        if (isLast) {
          // The last part is often the piece weight/volume spec e.g. "85G", "200G", "1L", "275ML", "1KG", "40G", "1G"
          // Or it might be a plain number if there is no weight spec (e.g. "PCT 1 X 6")
          const unitMatch = part.match(/^(\d+(?:[\.,]\d+)?)\s*(G|KG|ML|L|LT|GR|MG|CL)$/i);
          if (unitMatch) {
            // This is physical piece weight/volume - do NOT multiply packaging quantity by it
            continue;
          }

          // If it's a pure number at the end, it is a multiplier (e.g. "PCT 1 X 6")
          const numMatch = part.match(/^\d+$/);
          if (numMatch) {
            const val = parseInt(numMatch[0], 10);
            if (!isNaN(val) && val > 0) {
              multipliers.push(val);
            }
          }
        } else {
          // Non-last parts (e.g. "CXA 6", "FDO 10", "1", "12", "16", "27")
          const numMatch = part.match(/(\d+)/);
          if (numMatch) {
            const val = parseInt(numMatch[1], 10);
            if (!isNaN(val) && val > 0) {
              multipliers.push(val);
            }
          }
        }
      }

      if (multipliers.length > 0) {
        // Calculate total product of multipliers
        const totalMult = multipliers.reduce((acc, curr) => acc * curr, 1);
        return {
          tipoControle: 'UNIDADE',
          multiplicadorTotal: totalMult,
          unidadesPorPacote: totalMult,
          seguro: true,
        };
      }
    }
  }

  // 3. Fallback direct prefixes like "CX 24", "C/24", "CXA 12", "UND", "UN"
  const directNumMatch = rawUpper.match(/(?:CXA|CX|FARDO|FDO|FD|PCT|C\/|BDJ)\s*(\d+)\b/i);
  if (directNumMatch && directNumMatch[1]) {
    const val = parseInt(directNumMatch[1], 10);
    if (!isNaN(val) && val > 0) {
      return {
        tipoControle: 'UNIDADE',
        multiplicadorTotal: val,
        unidadesPorPacote: val,
        seguro: true,
      };
    }
  }

  // Simple single unit declarations: "UND", "UN", "UNIDADE", "PC", "PCA"
  if (rawUpper === 'UND' || rawUpper === 'UN' || rawUpper === 'UNIDADE' || rawUpper === 'PC' || rawUpper === 'PCA') {
    return {
      tipoControle: 'UNIDADE',
      multiplicadorTotal: 1,
      unidadesPorPacote: 1,
      seguro: true,
    };
  }

  // If cannot safely interpret
  return {
    tipoControle: 'NAO_IDENTIFICADO',
    multiplicadorTotal: 1,
    unidadesPorPacote: 1,
    seguro: false,
    motivo: 'EMBALAGEM NÃO INTERPRETADA',
  };
}

/**
 * Normalizes the sales quantity based on the packaging and control type.
 *
 * Rules:
 * - Weight (PESO e.g. "GR 1 X 1 X 1G"): QTD represents grams (e.g. 3590 -> 3590 g, 975 -> 975 g).
 * - Unit (UNIDADE e.g. "UND 1 X 1 X 200G"): QTD represents units (e.g. 38 -> 38 un).
 * - Box/Multi-pack (e.g. "CXA 1 X 27 X 200G"): QTD * 27 (e.g. 2 -> 54 un).
 * - Multi-factor (e.g. "CXA 6 X 12 X 85G"): QTD * 6 * 12 = QTD * 72 (e.g. 2 -> 144 un).
 * - Multi-factor (e.g. "FDO 10 X 16 X 40G"): QTD * 10 * 16 = QTD * 160 (e.g. 1 -> 160 un).
 * - Unclear: Returns seguro: false, motivo: 'EMBALAGEM NÃO INTERPRETADA'.
 */
export function normalizarQuantidadeVenda(
  qtdRaw: any,
  embalagemRaw: string,
  tipoControleHint?: TipoControle
): NormalizacaoVendaResult {
  // Parse raw numeric quantity
  let qtdNum = 0;
  if (typeof qtdRaw === 'number') {
    qtdNum = qtdRaw;
  } else if (qtdRaw !== undefined && qtdRaw !== null && qtdRaw !== '') {
    const clean = String(qtdRaw).trim().replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(clean);
    qtdNum = isNaN(parsed) ? 0 : parsed;
  }

  if (qtdNum <= 0) {
    return {
      qtdOriginal: 0,
      qtdNormalizada: 0,
      unidadeNormalizada: 'unidades',
      tipoControle: tipoControleHint || 'UNIDADE',
      seguro: true,
    };
  }

  const interpretacao = interpretarEmbalagemVenda(embalagemRaw);

  // If packaging is not safe, check if we have a firm hint from product catalog
  if (!interpretacao.seguro) {
    if (tipoControleHint === 'PESO') {
      // Direct grams
      const grams = Math.round(qtdNum);
      return {
        qtdOriginal: qtdNum,
        qtdNormalizada: grams,
        unidadeNormalizada: 'gramas',
        tipoControle: 'PESO',
        seguro: true,
      };
    }

    return {
      qtdOriginal: qtdNum,
      qtdNormalizada: 0,
      unidadeNormalizada: 'indefinido',
      tipoControle: 'NAO_IDENTIFICADO',
      seguro: false,
      motivo: interpretacao.motivo || 'EMBALAGEM NÃO INTERPRETADA',
    };
  }

  if (interpretacao.tipoControle === 'PESO') {
    // For PESO:
    // If QTD is in grams (e.g. 3590, 975):
    // Or if in decimal kg (e.g. 3.590):
    // Standard Atacadão report for GR 1 X 1 X 1G gives integer grams (3590) or decimal.
    let grams = 0;
    if (Number.isInteger(qtdNum) && qtdNum >= 10) {
      grams = qtdNum;
    } else {
      // If float like 3.59
      grams = Math.round(qtdNum * (qtdNum < 100 && !Number.isInteger(qtdNum) ? 1000 : 1));
    }

    return {
      qtdOriginal: qtdNum,
      qtdNormalizada: grams,
      unidadeNormalizada: 'gramas',
      tipoControle: 'PESO',
      seguro: true,
    };
  }

  // UNIDADE
  const mult = interpretacao.multiplicadorTotal || 1;
  const totalUnits = Math.round(qtdNum * mult);

  return {
    qtdOriginal: qtdNum,
    qtdNormalizada: totalUnits,
    unidadeNormalizada: 'unidades',
    tipoControle: 'UNIDADE',
    seguro: true,
  };
}

/**
 * Builds the unique Sale Identifier (saleId)
 * Format: [CNPJ_FILIAL|]DT.VENDA|NR.PDV|NR.CUPOM|SEQ
 * Example: "14/08/2026|502|636613|3" or "00000000000100|14/08/2026|502|636613|3"
 */
export function gerarSaleId(
  dtVenda: string,
  pdv: string | number,
  cupom: string | number,
  seq: string | number,
  cnpjFilial?: string
): string {
  const cleanDate = String(dtVenda || '').trim();
  const cleanPdv = String(pdv || '').trim();
  const cleanCupom = String(cupom || '').trim();
  const cleanSeq = String(seq || '').trim();
  const cleanCnpj = cnpjFilial ? String(cnpjFilial).trim().replace(/[^\w]/g, '') : '';

  const coreId = `${cleanDate}|${cleanPdv}|${cleanCupom}|${cleanSeq}`;
  return cleanCnpj ? `${cleanCnpj}|${coreId}` : coreId;
}

/**
 * Parses DT.VENDA and HORA into normalized string and epoch timestamp (ms).
 * Handles Excel date numbers, DD/MM/YYYY, YYYY-MM-DD, HH:MM, HH:MM:SS, and Excel time fractions.
 */
export function parseDataHoraVenda(
  dtVendaRaw: any,
  horaRaw: any
): {
  dataVendaStr: string; // "DD/MM/YYYY"
  horaStr: string;      // "HH:MM"
  timestampMs: number;
  dataHoraStr: string;  // "14/08/2026 15:12"
  valido: boolean;
} {
  let day = 1;
  let month = 1;
  let year = 2026;
  let hours = 0;
  let minutes = 0;
  let hasValidDate = false;

  // 1. Process Date
  if (dtVendaRaw instanceof Date) {
    day = dtVendaRaw.getDate();
    month = dtVendaRaw.getMonth() + 1;
    year = dtVendaRaw.getFullYear();
    hasValidDate = true;
  } else if (typeof dtVendaRaw === 'number' && dtVendaRaw > 20000 && dtVendaRaw < 80000) {
    // Excel serial date number
    const dateObj = new Date(Math.round((dtVendaRaw - 25569) * 86400 * 1000));
    day = dateObj.getUTCDate();
    month = dateObj.getUTCMonth() + 1;
    year = dateObj.getUTCFullYear();
    hasValidDate = true;
  } else if (typeof dtVendaRaw === 'string' && dtVendaRaw.trim()) {
    const str = dtVendaRaw.trim();
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parseInt(parts[2].slice(0, 4), 10);
        if (year < 100) year += 2000;
        hasValidDate = !isNaN(day) && !isNaN(month) && !isNaN(year);
      }
    } else if (str.includes('-')) {
      const parts = str.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          year = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10);
          day = parseInt(parts[2].slice(0, 2), 10);
        } else {
          day = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10);
          year = parseInt(parts[2].slice(0, 4), 10);
          if (year < 100) year += 2000;
        }
        hasValidDate = !isNaN(day) && !isNaN(month) && !isNaN(year);
      }
    }
  }

  // 2. Process Hour
  if (typeof horaRaw === 'number') {
    if (horaRaw >= 0 && horaRaw < 1) {
      // Excel fractional time of day
      const totalMinutes = Math.round(horaRaw * 24 * 60);
      hours = Math.floor(totalMinutes / 60) % 24;
      minutes = totalMinutes % 60;
    } else if (horaRaw >= 1 && horaRaw <= 2400) {
      // Integer like 1512 -> 15:12
      hours = Math.floor(horaRaw / 100);
      minutes = horaRaw % 100;
    }
  } else if (typeof horaRaw === 'string' && horaRaw.trim()) {
    const hStr = horaRaw.trim();
    if (hStr.includes(':')) {
      const parts = hStr.split(':');
      hours = parseInt(parts[0], 10) || 0;
      minutes = parseInt(parts[1], 10) || 0;
    } else if (/^\d{3,4}$/.test(hStr)) {
      const num = parseInt(hStr, 10);
      hours = Math.floor(num / 100);
      minutes = num % 100;
    }
  }

  const dayStr = String(day).padStart(2, '0');
  const monthStr = String(month).padStart(2, '0');
  const yearStr = String(year);
  const hourStr = String(hours).padStart(2, '0');
  const minStr = String(minutes).padStart(2, '0');

  const dataVendaStr = `${dayStr}/${monthStr}/${yearStr}`;
  const horaFormattedStr = `${hourStr}:${minStr}`;
  const dataHoraStr = `${dataVendaStr} ${horaFormattedStr}`;

  // Build local Date object for timestamp
  const dateObj = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const timestampMs = dateObj.getTime();

  return {
    dataVendaStr,
    horaStr: horaFormattedStr,
    timestampMs,
    dataHoraStr,
    valido: hasValidDate,
  };
}
