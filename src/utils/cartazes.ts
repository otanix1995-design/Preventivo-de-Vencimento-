/**
 * Utility functions for supermarket poster layout processing.
 */
import type { Produto, CartazItem, ControleVencimento } from '../types';

/**
 * Strips leading zeros from product code (e.g. "0070510" -> "70510")
 */
export function formatarCodigoSemZeros(codigo: string | number | undefined | null): string {
  if (codigo === undefined || codigo === null) return '';
  const str = String(codigo).trim();
  const withoutZeros = str.replace(/^0+/, '');
  return withoutZeros.length > 0 ? withoutZeros : '0';
}

/**
 * Extracts and removes trailing or embedded packaging info like:
 * "(KG 1 X 1000 X 1G)", "(CXA 1 X 10 X 1KG)", "(1KG)", "(510G)", "6X80G", etc.
 */
export function extrairEmbalagemDescricao(descricao: string): string {
  if (!descricao) return '';

  const matchParentheses = descricao.match(/\((.*?)\)/);
  if (matchParentheses) {
    return matchParentheses[1].trim();
  }

  const packagingPatterns = [
    /\b(\d+\s*[Kk][Gg])\b/,
    /\b(\d+\s*[Gg])\b/,
    /\b(\d+\s*[Ll])\b/,
    /\b(\d+\s*[Mm][Ll])\b/,
    /\b(\d+\s*[Xx]\s*\d+\s*[A-Za-z]*)\b/,
  ];

  for (const pat of packagingPatterns) {
    const match = descricao.match(pat);
    if (match) {
      return match[1].trim();
    }
  }

  return '';
}

/**
 * Extracts brand from description or buyer info
 */
export function extrairMarca(descricao: string, compradorFilial?: string): string {
  const commonBrands = [
    'BOB ESPONJA', 'BATAVO', 'ELEGE', 'ELEGÊ', 'AURORA', 'SEARA', 'SADIA',
    'PERDIGAO', 'PERDIGÃO', 'FRIMESA', 'ITAMBE', 'ITAMBÉ', 'NESTLE', 'NESTLÉ',
    'PIRACANJUBA', 'VIGOR', 'DANONE', 'CATUPIRY', 'TIROLEZ', 'POLENGHI',
    'PRESIDENT', 'COAMO', 'COCAMAR', 'TREVOS', 'DAMARE', 'BETANIA', 'BETÂNIA',
    'AVIAO', 'AVIÃO', 'PAMPLONA', 'REZENDE', 'CONFICA', 'QUALY', 'DANONINHO',
    'CHAMYTO', 'YAKULT', 'ACTIVIA', 'NINHO', 'CORPO CLIN', 'PAULISTA', 'POCOES'
  ];

  const descUpper = (descricao || '').toUpperCase();
  for (const b of commonBrands) {
    if (new RegExp(`\\b${b}\\b`, 'i').test(descUpper)) {
      return b;
    }
  }

  if (compradorFilial) {
    const compUpper = compradorFilial.toUpperCase();
    for (const b of commonBrands) {
      if (compUpper.includes(b)) {
        return b;
      }
    }
  }

  return '';
}

/**
 * Calculates price per kg based on packaging weight
 */
export function calcularPrecoKg(preco: number | null | undefined, embalagem: string): number | null {
  if (!preco || preco <= 0 || !embalagem) return null;

  const emb = embalagem.toUpperCase();
  // Check grams e.g. "170G", "510G", "1000G"
  const matchG = emb.match(/(\d+)\s*G\b/);
  if (matchG) {
    const g = parseFloat(matchG[1]);
    if (g > 0 && g !== 1000) {
      return (preco / g) * 1000;
    }
    if (g === 1000) return preco;
  }

  // Check kg e.g. "1KG", "2KG"
  const matchKg = emb.match(/(\d+(?:[.,]\d+)?)\s*KG\b/);
  if (matchKg) {
    const kg = parseFloat(matchKg[1].replace(',', '.'));
    if (kg > 0) {
      return preco / kg;
    }
  }

  return null;
}

/**
 * Parses product description into structured parts for the TAGG layout:
 * - Linha 1: Tipo Principal (ex: "LEITE", "MORTADELA", "IOGURTE", "BEB.LACTEA")
 * - Linha 2: Marca (ex: "BOB ESPONJA", "BATAVO", "ELEGE", "AURORA")
 * - Linha 3: Sabor / Variação (ex: "MORANGO", "JABUTICABA", "POLPA MG/AMEIXA", "TRADICIONAL")
 */
export function decomporDescricaoTag(descricao: string, marcaInformada?: string): {
  tipo: string;
  marcaLinha: string;
  variacao: string;
} {
  let raw = (descricao || '').trim().toUpperCase();
  if (!raw) return { tipo: '', marcaLinha: '', variacao: '' };

  // Remove common system/ERP prefixes
  raw = raw
    .replace(/^RF\.\s*/i, '')
    .replace(/^RESFR\.\s*/i, '')
    .replace(/^CONG\.\s*/i, '')
    .replace(/^CX\.\s*/i, '')
    .replace(/^PCT\.\s*/i, '')
    .replace(/^FD\.\s*/i, '')
    .replace(/^UN\.\s*/i, '')
    .replace(/^EMB\.\s*/i, '')
    .replace(/^PROD\.\s*/i, '')
    .replace(/\b[NnEePpDdSsCcRr]\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Find brand
  let marcaDetectada = (marcaInformada || '').trim().toUpperCase();
  if (!marcaDetectada) {
    marcaDetectada = extrairMarca(raw);
  }

  // Common product categories
  const categoryPrefixes = [
    'BEB.LACTEA', 'BEB LACTEA', 'BEB. LÁCTEA', 'BEBIDA LACTEA', 'BEBIDA LÁCTEA',
    'IOGURTE', 'IOG.', 'LEITE UHT', 'LEITE', 'MORTADELA', 'PRESUNTO', 'APRESUNTADO',
    'QUEIJO PRATO', 'QUEIJO MUSSARELA', 'QUEIJO', 'REQUEIJAO', 'REQUEIJÃO',
    'MANTEIGA', 'MARGARINA', 'LINGUICA', 'LINGUIÇA', 'SALSICHA', 'HAMBURGUER',
    'HUMBÚRGUER', 'NUGGETS', 'EMPANADO', 'LASANHA', 'PIZZA', 'PETISCO', 'BACON',
    'FILE DE PEITO', 'COXA E SOBRECOXA', 'FRANGO', 'CARNE', 'ACUCAR', 'ARROZ', 'FEIJAO'
  ];

  let tipo = '';
  let rest = raw;

  for (const cp of categoryPrefixes) {
    const regex = new RegExp(`^${cp.replace(/\./g, '\\.')}\\b`, 'i');
    if (regex.test(raw)) {
      tipo = cp.replace(/\s+/g, ' ');
      rest = raw.replace(regex, '').trim();
      break;
    }
  }

  if (!tipo) {
    const words = raw.split(/\s+/);
    tipo = words[0] || '';
    rest = words.slice(1).join(' ');
  }

  // Aggressively clean rest from isolated single-letter system classification codes
  rest = rest.replace(/\b[NnEePpDdSsCcRr]\b/g, ' ').replace(/\s+/g, ' ').trim();

  let marcaLinha = marcaDetectada;
  let variacao = rest;

  if (marcaDetectada && rest.includes(marcaDetectada)) {
    variacao = rest.replace(new RegExp(`\\b${marcaDetectada}\\b`, 'gi'), '').trim();
  } else if (!marcaLinha) {
    const words = rest.split(/\s+/);
    if (words.length > 1) {
      marcaLinha = words[0];
      variacao = words.slice(1).join(' ');
    } else {
      marcaLinha = rest;
      variacao = '';
    }
  }

  variacao = variacao
    .replace(/\(.*?\)/g, '')
    .replace(/\bKG\s*\d+\s*X\s*\d+.*?\b/gi, '')
    .replace(/\bCXA\s*\d+\s*X\s*\d+.*?\b/gi, '')
    .replace(/\b\d+X\d+[A-Z]*\b/gi, '')
    .replace(/\b\d+[KkGgLlMm]+\b/gi, '')
    .replace(/\b[NnEePpDdSsCcRr]\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    tipo,
    marcaLinha,
    variacao: variacao || '',
  };
}

/**
 * Extracts or computes tax info (TRIB: R$ X,XX (XX,XX)%)
 */
export function extrairInfoTributaria(produto: Produto, precoVenda?: number | null): string {
  if (produto.outrasColunas) {
    const taxKeys = ['TRIB', 'TRIBUTOS', 'TRIBUTACAO', 'IMPOSTO', 'IMPOSTOS', 'ALIQUOTA', 'ICMS'];
    for (const [key, val] of Object.entries(produto.outrasColunas)) {
      const upperKey = key.toUpperCase();
      if (taxKeys.some((tk) => upperKey.includes(tk))) {
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const strVal = String(val).trim();
          if (strVal.startsWith('TRIB:')) return strVal;
          if (strVal.includes('R$') || strVal.includes('%')) return `TRIB: ${strVal}`;
        }
      }
    }
  }

  if (precoVenda && precoVenda > 0) {
    const perc = 31.45;
    const vlr = Math.round(precoVenda * (perc / 100) * 100) / 100;
    return `TRIB: R$ ${vlr.toFixed(2).replace('.', ',')} (${perc.toFixed(2).replace('.', ',')}%)`;
  }

  return 'TRIB: R$ 0,00 (0,00)%';
}

/**
 * Attempts to extract price from product's extra columns if no controlled price exists
 */
export function extrairPrecoBaseProduto(produto: Produto): number | null {
  if (!produto.outrasColunas) return null;

  const priceKeys = ['PRECO', 'PRECO_VENDA', 'PRECOVENDA', 'VALOR', 'VLR', 'UNIT', 'PRECO_UNIT'];
  for (const [key, val] of Object.entries(produto.outrasColunas)) {
    const upper = key.toUpperCase();
    if (priceKeys.some((pk) => upper.includes(pk))) {
      if (typeof val === 'number' && val > 0) return val;
      if (typeof val === 'string') {
        const cleaned = val.replace(/[^\d.,]/g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        if (!isNaN(num) && num > 0) return num;
      }
    }
  }

  return null;
}

/**
 * Creates a CartazItem from a Produto and optional ControleVencimento
 * Strictly contains required fields without Tributação or Média por KG.
 */
export function criarCartazItemDeProduto(
  produto: Produto,
  controle?: ControleVencimento,
  precoSobrescrito?: number | null,
  quantidadeCartazes: number = 1
): CartazItem {
  const preco =
    precoSobrescrito !== undefined && precoSobrescrito !== null
      ? precoSobrescrito
      : controle?.precoTrabalhado !== undefined && controle?.precoTrabalhado !== null
      ? controle.precoTrabalhado
      : extrairPrecoBaseProduto(produto);

  const marca = extrairMarca(produto.descricao, produto.compradorFilial);
  const embalagem = produto.embalagem || extrairEmbalagemDescricao(produto.descricao) || 'UN';

  // Units per box if present in product or control
  const unidadesPorCaixa = controle?.unidadesPorCaixa || produto.unidadesPorCaixa;
  let precoCaixa: number | undefined = undefined;
  if (preco && unidadesPorCaixa && unidadesPorCaixa > 1) {
    precoCaixa = Math.round(preco * unidadesPorCaixa * 100) / 100;
  }

  return {
    id: controle ? `c_${controle.id}` : `p_${produto.id}_${Date.now()}`,
    produtoId: produto.id,
    codigo: produto.codigo,
    dig: produto.dig,
    descricao: produto.descricao,
    embalagem,
    marca,
    unidadesPorCaixa,
    precoCaixa,
    tipoControle: produto.tipoControle || 'UNIDADE',
    precoVenda: preco,
    dataVencimento: controle?.dataVencimento || '',
    quantidadeCartazes,
  };
}
