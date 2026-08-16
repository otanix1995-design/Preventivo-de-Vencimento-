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
 * PESO, 500 -> "500 g"
 * UNIDADE, 130 -> "130 unidades"
 * UNIDADE, 45 (unidadesPorCaixa: 20) -> "45 un (2 cx + 5 un)"
 */
export function formatarQuantidade(
  valor: number,
  tipoControle: TipoControle,
  resumido = false,
  unidadesPorCaixa?: number
): string {
  if (tipoControle === 'UNIDADE') {
    const units = Math.max(0, Math.round(valor || 0));
    if (unidadesPorCaixa && unidadesPorCaixa > 1) {
      const cx = Math.floor(units / unidadesPorCaixa);
      const un = units % unidadesPorCaixa;
      if (cx > 0 && un > 0) {
        return resumido ? `${cx} cx + ${un} un` : `${units} un (${cx} cx + ${un} un)`;
      } else if (cx > 0) {
        return resumido ? `${cx} cx` : `${units} un (${cx} ${cx === 1 ? 'caixa' : 'caixas'})`;
      } else {
        return resumido ? `${un} un` : `${un} ${un === 1 ? 'unidade' : 'unidades'}`;
      }
    }
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
 * Formats a sales quantity for display
 * Examples:
 * PESO, 350 -> "350 g"
 * PESO, 10350 -> "10 kg 350 g"
 * UNIDADE, 30 (unidadesPorCaixa: 20) -> "30 unidades (1 cx + 10 un)"
 */
export function formatarVendaIdentificada(
  venda: number,
  tipoControle: TipoControle,
  unidadesPorCaixa?: number
): string {
  const safeVenda = Math.max(0, Math.round(venda || 0));
  if (tipoControle === 'PESO') {
    return formatarQuantidade(safeVenda, 'PESO');
  }

  if (tipoControle === 'UNIDADE') {
    if (unidadesPorCaixa && unidadesPorCaixa > 1) {
      const cx = Math.floor(safeVenda / unidadesPorCaixa);
      const un = safeVenda % unidadesPorCaixa;
      if (cx > 0 && un > 0) {
        return `${safeVenda} un (${cx} cx + ${un} un)`;
      } else if (cx > 0) {
        return `${safeVenda} un (${cx} ${cx === 1 ? 'caixa' : 'caixas'})`;
      }
    }
    return `${safeVenda} ${safeVenda === 1 ? 'unidade' : 'unidades'}`;
  }

  return `${safeVenda}`;
}

/**
 * Parses raw "Quantidade de Venda 30 Dias" value from Excel
 * Returns internal numeric value (grams for PESO, integer units for UNIDADE) and raw string.
 *
 * Examples for PESO:
 * - "174.814" -> 174814 grams
 * - "175.164" -> 175164 grams
 * - "10.000" -> 10000 grams
 * - "10.350" -> 10350 grams
 * - 10.35 (number) -> 10350 grams
 * - 10 (number) -> 10000 grams
 * - 40 (number for PESO) -> 40000 grams
 *
 * Examples for UNIDADE:
 * - "40" -> 40 units
 * - "10" -> 10 units
 * - 40 (number) -> 40 units
 */
export function parseVenda30Dias(
  rawVal: any,
  tipoControle: TipoControle
): { numericVal: number; rawStr: string } {
  if (rawVal === undefined || rawVal === null || rawVal === '') {
    return { numericVal: 0, rawStr: '0' };
  }

  const rawStr = String(rawVal).trim();

  if (tipoControle === 'UNIDADE') {
    if (typeof rawVal === 'number') {
      return { numericVal: Math.max(0, Math.round(rawVal)), rawStr };
    }
    const cleanStr = rawStr.replace(/[^\d]/g, '');
    const num = parseInt(cleanStr, 10);
    return { numericVal: isNaN(num) ? 0 : Math.max(0, num), rawStr };
  }

  if (tipoControle === 'PESO') {
    if (typeof rawVal === 'number') {
      // If rawVal is 174.814 (174 kg 814 g), multiplying by 1000 gives 174814 grams
      // If rawVal is 10.35 (10 kg 350 g), multiplying by 1000 gives 10350 grams
      // If rawVal is 10 (10 kg), multiplying by 1000 gives 10000 grams
      return { numericVal: Math.max(0, Math.round(rawVal * 1000)), rawStr };
    }

    const str = rawStr.trim();
    // Check if string contains "kg" or "g"
    if (str.toLowerCase().includes('kg') || str.toLowerCase().includes('g')) {
      const kgMatch = str.match(/(\d+(?:[\.,]\d+)?)\s*kg/i);
      const gMatch = str.match(/(\d+)\s*g/i);
      let kg = 0;
      let g = 0;
      if (kgMatch) kg = parseFloat(kgMatch[1].replace(',', '.'));
      if (gMatch) g = parseInt(gMatch[1], 10);
      return { numericVal: Math.max(0, Math.round(kg * 1000 + g)), rawStr };
    }

    // Check Brazilian format with 3 decimal places e.g. "174.814" or "174,814" or "10.350" or "10.000"
    if (/^\d+[\.,]\d{3}$/.test(str)) {
      const parts = str.split(/[\.,]/);
      const kg = parseInt(parts[0], 10) || 0;
      const g = parseInt(parts[1], 10) || 0;
      return { numericVal: Math.max(0, kg * 1000 + g), rawStr };
    }

    // General decimal e.g. "10,5" or "10.5" or "10"
    let clean = str.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(clean);
    if (!isNaN(parsed)) {
      return { numericVal: Math.max(0, Math.round(parsed * 1000)), rawStr };
    }

    return { numericVal: 0, rawStr };
  }

  // Fallback
  const parsed = parseFloat(String(rawVal).replace(',', '.'));
  return { numericVal: isNaN(parsed) ? 0 : Math.max(0, Math.round(parsed)), rawStr };
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

  // Parse numeric string format safely
  let cleanStr = strVal;
  if (cleanStr.includes(',')) {
    // Brazilian format: "150.500,50" or "150,5" or "150,500"
    cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
  }

  const num = parseFloat(cleanStr);
  if (isNaN(num)) return 0;

  if (tipoControle === 'PESO') {
    return Math.round(num * 1000);
  }
  return Math.round(num);
}
