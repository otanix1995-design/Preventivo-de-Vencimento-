import type { TipoControle } from '../types';

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
