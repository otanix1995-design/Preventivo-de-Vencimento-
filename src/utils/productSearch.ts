import { db } from '../db/database';
import type { Produto, VinculoEAN } from '../types';
import { normalizarCodigoEDig, normalizarEan } from './excel';

export interface ResultadoBuscaProduto {
  encontrado: boolean;
  produto: Produto | null;
  vinculo: VinculoEAN | null;
  codigoBuscado: string;
  tipoOrigem: 'VINCULO_EAN' | 'CODIGO_DIRETO' | 'CODIGO_ORIGINAL' | 'VINCULO_SEM_CADASTRO' | 'NAO_ENCONTRADO';
  mensagem?: string;
}

/**
 * Robust product / barcode search across IndexedDB
 * Handles EAN-13, EAN-14 (GTIN-14), UPC-A (12-digit), EAN-8,
 * variations with/without leading zeros, and direct internal code queries.
 */
export async function buscarProdutoPorEanOuCodigo(
  termoBusca: string
): Promise<ResultadoBuscaProduto> {
  const raw = String(termoBusca || '').trim();
  if (!raw) {
    return {
      encontrado: false,
      produto: null,
      vinculo: null,
      codigoBuscado: '',
      tipoOrigem: 'NAO_ENCONTRADO',
      mensagem: 'Nenhum código fornecido para busca.',
    };
  }

  const cleanEan = normalizarEan(raw);
  const strippedEan = cleanEan.replace(/^0+/, '');

  // 1. Generate all candidate EAN keys
  const eanCandidates = new Set<string>();
  if (cleanEan) eanCandidates.add(cleanEan);
  if (raw) eanCandidates.add(raw);
  if (strippedEan) eanCandidates.add(strippedEan);

  // GTIN-14 / EAN-13 / UPC-A format conversions
  if (cleanEan.length === 14 && cleanEan.startsWith('0')) {
    eanCandidates.add(cleanEan.slice(1)); // 13 digits
    eanCandidates.add(cleanEan.slice(2)); // 12 digits
  }
  if (cleanEan.length === 13) {
    eanCandidates.add('0' + cleanEan); // 14 digits GTIN
  }
  if (cleanEan.length === 12) {
    eanCandidates.add('0' + cleanEan);   // 13 digits
    eanCandidates.add('00' + cleanEan);  // 14 digits
  }
  if (cleanEan.length === 8) {
    eanCandidates.add('000000' + cleanEan); // 14 digits
  }

  // 2. Search in db.vinculosEan by indexed queries
  let vinculo: VinculoEAN | undefined = undefined;

  for (const cand of eanCandidates) {
    vinculo = await db.vinculosEan.where('ean').equals(cand).first();
    if (vinculo) break;
  }

  // Fallback search across vinculos if not matched by indexed equals (e.g. leading zero mismatch)
  if (!vinculo && strippedEan.length >= 5) {
    const allLinks = await db.vinculosEan.toArray();
    vinculo = allLinks.find((v) => {
      const vClean = normalizarEan(v.ean).replace(/^0+/, '');
      return vClean === strippedEan;
    });
  }

  // 3. If Vinculo is found: get or synthesize the Produto record
  if (vinculo) {
    let prod: Produto | undefined = undefined;

    // Try primary key ID
    if (vinculo.produtoId) {
      prod = await db.produtos.get(vinculo.produtoId);
    }
    // Try codigo
    if (!prod && vinculo.codigo) {
      prod = await db.produtos.get(vinculo.codigo);
    }
    if (!prod && vinculo.codigo) {
      prod = await db.produtos.where('codigo').equals(vinculo.codigo).first();
    }
    // Try without leading zeros
    if (!prod && vinculo.codigo) {
      const codStripped = vinculo.codigo.replace(/^0+/, '');
      prod = await db.produtos.where('codigo').equals(codStripped).first();
    }
    // Try by codigoOriginal
    if (!prod && vinculo.codigoOriginal) {
      prod = await db.produtos.where('codigoOriginal').equals(vinculo.codigoOriginal).first();
    }
    if (!prod && vinculo.produtoId) {
      prod = await db.produtos.where('codigoOriginal').equals(vinculo.produtoId).first();
    }

    // If product is not yet in db.produtos (e.g. EAN sheet imported before/without stock sheet),
    // synthesize the Produto record so the user can immediately register expiration dates!
    if (!prod) {
      const nowIso = new Date().toISOString();
      const codClean = (vinculo.codigo || vinculo.produtoId || '').replace(/^0+/, '') || '0';
      const digClean = vinculo.dig || '';
      const codigoOrig =
        vinculo.codigoOriginal ||
        (digClean ? `00000000${codClean}`.slice(-8) + `-${digClean}` : codClean);

      prod = {
        id: codClean,
        codigo: codClean,
        dig: digClean,
        codigoOriginal: codigoOrig,
        descricao: vinculo.descricao || `PRODUTO CÓDIGO ${codClean}${digClean ? '-' + digClean : ''}`,
        embalagem: 'UNIDADE',
        tipoControle: 'UNIDADE',
        compradorFilial: 'VÍNCULO EAN',
        estoqueEmb1: '0',
        estoqueEmb9: '0',
        criadoEm: nowIso,
        atualizadoEm: nowIso,
      };

      try {
        await db.produtos.put(prod);
      } catch {
        // Ignore put errors if any
      }

      return {
        encontrado: true,
        produto: prod,
        vinculo,
        codigoBuscado: raw,
        tipoOrigem: 'VINCULO_SEM_CADASTRO',
        mensagem: `Produto localizado via Vínculo EAN (${vinculo.ean} → ${codClean}).`,
      };
    }

    return {
      encontrado: true,
      produto: prod,
      vinculo,
      codigoBuscado: raw,
      tipoOrigem: 'VINCULO_EAN',
      mensagem: `Produto localizado via Vínculo EAN (${vinculo.ean} → ${prod.codigo}).`,
    };
  }

  // 4. If No Vinculo: check if the scanned input is directly an internal product code
  const { codigo: normCod, dig: normDig, codigoOriginal: normOrig } = normalizarCodigoEDig(raw);
  let prodDireto: Produto | undefined = undefined;

  // By primary key ID
  prodDireto = await db.produtos.get(raw);
  if (!prodDireto && normCod) {
    prodDireto = await db.produtos.get(normCod);
  }
  // By indexed codigo
  if (!prodDireto && normCod) {
    prodDireto = await db.produtos.where('codigo').equals(normCod).first();
  }
  // By indexed codigoOriginal
  if (!prodDireto && normOrig) {
    prodDireto = await db.produtos.where('codigoOriginal').equals(normOrig).first();
  }
  if (!prodDireto && raw) {
    prodDireto = await db.produtos.where('codigoOriginal').equals(raw).first();
  }
  // By stripped zeros
  if (!prodDireto && strippedEan) {
    prodDireto = await db.produtos.where('codigo').equals(strippedEan).first();
  }

  if (prodDireto) {
    return {
      encontrado: true,
      produto: prodDireto,
      vinculo: null,
      codigoBuscado: raw,
      tipoOrigem: 'CODIGO_DIRETO',
      mensagem: `Produto localizado pelo código interno ${prodDireto.codigo}.`,
    };
  }

  return {
    encontrado: false,
    produto: null,
    vinculo: null,
    codigoBuscado: raw,
    tipoOrigem: 'NAO_ENCONTRADO',
    mensagem: `Código/EAN "${raw}" não possui vínculo ativo nem cadastro de produto.`,
  };
}
