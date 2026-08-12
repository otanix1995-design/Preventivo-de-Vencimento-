import type { StatusVencimento } from '../types';

/**
 * Calculates days remaining until expiration date
 * @param dateStr Date in YYYY-MM-DD or ISO format
 * @returns Number of days (negative means already expired)
 */
export function calcularDiasAteVencimento(dateStr: string): number {
  if (!dateStr) return 0;

  // Parse YYYY-MM-DD cleanly without timezone shift
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return 0;

  const targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Automatically determines status based on current date vs expiration date
 */
export function calcularStatusVencimento(dataVencimentoStr: string): StatusVencimento {
  const dias = calcularDiasAteVencimento(dataVencimentoStr);

  if (dias < 0) return 'VENCIDO';
  if (dias === 0) return 'VENCE_HOJE';
  if (dias <= 3) return 'VENCE_3_DIAS';
  if (dias <= 7) return 'VENCE_7_DIAS';
  return 'MAIS_7_DIAS';
}

/**
 * Formats YYYY-MM-DD or ISO date string to Brazilian format DD/MM/YYYY
 */
export function formatarDataBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const cleanStr = dateStr.split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Gets current timestamp formatted like "11/08/2026 — 07:35"
 */
export function getFormattedTimestamp(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} — ${hours}:${minutes}`;
}

/**
 * Returns metadata for status badges (label, tailwind classes, priority order)
 */
export function getStatusConfig(status: StatusVencimento) {
  switch (status) {
    case 'VENCIDO':
      return {
        label: 'VENCIDO',
        icon: '🔴',
        priority: 1,
        bgClass: 'bg-red-100 dark:bg-red-950/60',
        textClass: 'text-red-700 dark:text-red-300',
        borderClass: 'border-red-300 dark:border-red-800',
      };
    case 'VENCE_HOJE':
      return {
        label: 'VENCE HOJE',
        icon: '🟠',
        priority: 2,
        bgClass: 'bg-amber-100 dark:bg-amber-950/60',
        textClass: 'text-amber-800 dark:text-amber-300',
        borderClass: 'border-amber-300 dark:border-amber-800',
      };
    case 'VENCE_3_DIAS':
      return {
        label: 'VENCE EM ATÉ 3 DIAS',
        icon: '🟡',
        priority: 3,
        bgClass: 'bg-yellow-100 dark:bg-yellow-950/60',
        textClass: 'text-yellow-800 dark:text-yellow-300',
        borderClass: 'border-yellow-300 dark:border-yellow-800',
      };
    case 'VENCE_7_DIAS':
      return {
        label: 'VENCE EM ATÉ 7 DIAS',
        icon: '🟡',
        priority: 4,
        bgClass: 'bg-yellow-50 dark:bg-yellow-950/40',
        textClass: 'text-yellow-700 dark:text-yellow-400',
        borderClass: 'border-yellow-200 dark:border-yellow-900',
      };
    case 'MAIS_7_DIAS':
      return {
        label: 'MAIS DE 7 DIAS',
        icon: '🟢',
        priority: 5,
        bgClass: 'bg-emerald-100 dark:bg-emerald-950/60',
        textClass: 'text-emerald-800 dark:text-emerald-300',
        borderClass: 'border-emerald-300 dark:border-emerald-800',
      };
  }
}

/**
 * Formats a currency value to R$ 0,00
 */
export function formatarMoeda(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Safely parses price string into a float number.
 * Handles format like "49,90", "49.90", "R$ 49,90", "1.250,50"
 */
export function parsePrecoString(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return isNaN(input) ? null : input;

  let str = String(input).replace('R$', '').trim();
  if (!str) return null;

  if (str.includes(',')) {
    // Thousands dot, decimal comma (e.g. "1.250,50" or "49,90")
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes('.')) {
    // If no comma, check if multiple dots
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      str = str.replace(/\./g, '');
    }
    // Single dot (e.g. "49.90") is left as is for parseFloat
  }

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}
