import type { TipoControle } from '../types';

/**
 * Extracts the number of units per box from the packaging string.
 * Examples:
 * - "CXA 1 X 20 X 170G" -> 20
 * - "CXA 1 X 15 X 400G" -> 15
 * - "CXA 1 X 10 X 500G" -> 10
 * - "FARDO 1 X 12 X 1KG" -> 12
 * - "PCT 1 X 6" -> 6
 * - "CX 24" -> 24
 * - "KG 1 X 1000 X 1G" -> 1
 */
export function extrairUnidadesPorCaixa(embalagemRaw: string): number {
  if (!embalagemRaw) return 1;

  const emb = embalagemRaw.toUpperCase().trim();

  // If it's pure weight (KG 1 X 1000 X 1G), return 1 (grams handled by weight logic)
  if (emb.startsWith('KG') && !emb.includes('CX') && !emb.includes('FARDO')) {
    return 1;
  }

  // Pattern 1: Match "1 X 20 X 170G" or "1X20X" or "CXA 1 X 15 X 400G" or "1 X 10 X 500G"
  const multiXMatch = emb.match(/\b\d+\s*X\s*(\d+)\s*X/i);
  if (multiXMatch && multiXMatch[1]) {
    const val = parseInt(multiXMatch[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // Pattern 2: Match "CXA 1 X 20" or "FARDO 1 X 12" or "PCT 1 X 6"
  const singleXMatch = emb.match(/\b1\s*X\s*(\d+)\b/i);
  if (singleXMatch && singleXMatch[1]) {
    const val = parseInt(singleXMatch[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // Pattern 3: Match "CX 24" or "CXA 12" or "FD 10" or "C/24" or "C/ 20"
  const prefixMatch = emb.match(/(?:CXA|CX|FARDO|FD|PCT|C\/)\s*(\d+)\b/i);
  if (prefixMatch && prefixMatch[1]) {
    const val = parseInt(prefixMatch[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // Default fallback
  return 1;
}

/**
 * Converts total units into EMB1 (boxes) and EMB9 (loose units)
 * Example: 30 units with 20 units/box -> EMB1 = 1, EMB9 = 10
 * Example: 35 units with 15 units/box -> EMB1 = 2, EMB9 = 5
 * Example: 25 units with 10 units/box -> EMB1 = 2, EMB9 = 5
 */
export function converterUnidadesParaEmb1Emb9(
  totalUnidades: number,
  unidadesPorCaixa: number = 1
): { emb1: number; emb9: number } {
  const safeUnits = Math.max(0, Math.round(totalUnidades || 0));
  const factor = Math.max(1, Math.round(unidadesPorCaixa || 1));

  if (factor <= 1) {
    return { emb1: safeUnits, emb9: 0 };
  }

  const emb1 = Math.floor(safeUnits / factor);
  const emb9 = safeUnits % factor;
  return { emb1, emb9 };
}

/**
 * Converts EMB1 (boxes) and EMB9 (loose units) into total units
 * Example: 3 boxes + 15 units with 20 units/box -> 3*20 + 15 = 75 units
 */
export function converterEmb1Emb9ParaUnidades(
  emb1: number,
  emb9: number,
  unidadesPorCaixa: number = 1
): number {
  const safeEmb1 = Math.max(0, Math.floor(emb1 || 0));
  const safeEmb9 = Math.max(0, Math.floor(emb9 || 0));
  const factor = Math.max(1, Math.round(unidadesPorCaixa || 1));

  return safeEmb1 * factor + safeEmb9;
}

/**
 * Analyzes packaging string from Excel to identify whether control is by PESO (Weight) or UNIDADE (Unit).
 * 
 * Rules:
 * - "KG 1 X 1000 X 1G" -> PESO
 * - "CXA 1 X 15 X 400G" -> UNIDADE (units = 15)
 * - "CX", "CXA", "UN", "UND", "PCT", "FARDO", "FD", "BD", "LT", "POTE" -> UNIDADE
 * - Unclear -> NAO_IDENTIFICADO
 */
export function identificarTipoEmbalagem(embalagemRaw: string): TipoControle {
  if (!embalagemRaw) return 'NAO_IDENTIFICADO';

  const emb = embalagemRaw.toUpperCase().trim();

  // Pattern 1: Pure weight (e.g., "KG 1 X 1000 X 1G", "KG", "KG 1X1000", "KILO", "KG 1 X 1", "KG1X1000X1G")
  if (
    emb.startsWith('KG') ||
    emb.includes('KILO') ||
    emb.includes('1000 X 1G') ||
    emb.includes('1000X1G') ||
    emb.includes('1 X 1000') ||
    emb === 'KG'
  ) {
    // Check if it's actually a box of weight items where unit count dominates, e.g. "CXA 1 X 15 X 400G"
    // If it starts with CXA/CX/FARDO/PCT/UN, it's UNIDADE even if it mentions grams at the end.
    if (
      emb.startsWith('CX') ||
      emb.startsWith('CXA') ||
      emb.startsWith('UN') ||
      emb.startsWith('UND') ||
      emb.startsWith('PCT') ||
      emb.startsWith('FARDO') ||
      emb.startsWith('FD')
    ) {
      return 'UNIDADE';
    }
    return 'PESO';
  }

  // Pattern 2: Unit based packages (CXA, CX, UN, UND, PCT, FARDO, FD, BD, LT, AMP, POTE, PT, SAC)
  const unitPrefixes = ['CXA', 'CX', 'UN', 'UND', 'PCT', 'FARDO', 'FD', 'BD', 'LT', 'AMP', 'POTE', 'PT', 'SAC', 'CJ', 'KIT'];
  for (const prefix of unitPrefixes) {
    if (emb.startsWith(prefix) || emb.includes(` ${prefix} `) || emb.includes(` ${prefix}`)) {
      return 'UNIDADE';
    }
  }

  // Default fallback check
  if (emb.includes('G') && !emb.includes('KG')) {
    // E.g. "400G" in a unit package
    if (emb.includes('CX') || emb.includes('X')) {
      return 'UNIDADE';
    }
  }

  return 'NAO_IDENTIFICADO';
}

/**
 * Friendly label for packaging control type
 */
export function getTipoControleLabel(tipo: TipoControle): string {
  switch (tipo) {
    case 'PESO':
      return 'PESO (Kg / g)';
    case 'UNIDADE':
      return 'UNIDADE (un)';
    case 'NAO_IDENTIFICADO':
      return 'Não Identificado';
  }
}
