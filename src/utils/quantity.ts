import type { TipoControle } from '../types';

/**
 * Converts kg and grams into total grams integer
 * e.g., 130 kg and 500 g -> 130500
 */
export function converterParaGramas(kg: number, g: number): number {
  const kgVal = Math.max(0, Math.floor(kg || 0));
  const gVal = Math.max(0, Math.floor(g || 0));
  return kgVal * 1000 + gVal;
}

/**
 * Splits total grams into { kg, g }
 * e.g., 130500 -> { kg: 130, g: 500 }
 */
export function gramasParaKgEGramas(totalGramas: number): { kg: number; g: number } {
  const safeGramas = Math.max(0, Math.round(totalGramas || 0));
  const kg = Math.floor(safeGramas / 1000);
  const g = safeGramas % 1000;
  return { kg, g };
}

/**
 * Formats internal numerical quantity for UI display based on control type
 * 
 * Examples:
 * PESO, 130500 -> "130 kg 500 g"
 * PESO, 130000 -> "130 kg"
 * PESO, 500 -> "0 kg 500 g"
 * UNIDADE, 130 -> "130 unidades"
 */
export function formatarQuantidade(
  valor: number,
  tipoControle: TipoControle,
  resumido = false
): string {
  if (tipoControle === 'UNIDADE') {
    const units = Math.max(0, Math.round(valor || 0));
    return resumido ? `${units} un` : `${units} ${units === 1 ? 'unidade' : 'unidades'}`;
  }

  if (tipoControle === 'PESO') {
    const { kg, g } = gramasParaKgEGramas(valor);
    if (kg > 0 && g > 0) {
      return `${kg} kg ${g} g`;
    } else if (kg > 0) {
      return `${kg} kg`;
    } else {
      return `${g} g`;
    }
  }

  // Fallback for non-identified
  return `${valor}`;
}

/**
 * Parses raw stock value from Excel (which could be number or string like "150,5", "150 kg 500 g", etc.)
 * into numeric representation (grams for PESO, integer units for UNIDADE)
 */
export function parseEstoqueExcelToNumeric(
  rawVal: string | number | undefined | null,
  tipoControle: TipoControle
): number {
  if (rawVal === undefined || rawVal === null || rawVal === '') {
    return 0;
  }

  if (typeof rawVal === 'number') {
    if (tipoControle === 'PESO') {
      // If raw number in Excel is e.g. 130.5 (meaning 130.5 kg)
      return Math.round(rawVal * 1000);
    }
    return Math.round(rawVal);
  }

  const strVal = String(rawVal).trim().toLowerCase();

  // If string contains "kg" or "g"
  if (strVal.includes('kg') || strVal.includes('g')) {
    const kgMatch = strVal.match(/(\d+(?:[\.,]\d+)?)\s*kg/);
    const gMatch = strVal.match(/(\d+)\s*g/);

    let kg = 0;
    let g = 0;

    if (kgMatch) {
      kg = parseFloat(kgMatch[1].replace(',', '.'));
    }
    if (gMatch) {
      g = parseInt(gMatch[1], 10);
    }

    if (tipoControle === 'PESO') {
      return Math.round(kg * 1000 + g);
    }
    return Math.round(kg + g);
  }

  // Standard numeric string e.g. "150,500" or "150"
  const cleanStr = strVal.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleanStr);
  if (isNaN(num)) return 0;

  if (tipoControle === 'PESO') {
    return Math.round(num * 1000);
  }
  return Math.round(num);
}
