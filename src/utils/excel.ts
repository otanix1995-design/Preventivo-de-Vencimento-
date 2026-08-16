import * as XLSX from 'xlsx';
import { db } from '../db/database';
import type { Produto, TipoControle } from '../types';
import { identificarTipoEmbalagem, extrairUnidadesPorCaixa, converterUnidadesParaEmb1Emb9 } from './packaging';
import { parseEstoqueExcelToNumeric, parseVenda30Dias, formatarQuantidade } from './quantity';
import { getFormattedTimestamp, calcularStatusVencimento } from './date';

export interface CodeDigResult {
  codigo: string;          // e.g. "70510"
  dig: string;             // e.g. "150"
  codigoOriginal: string;  // e.g. "00070510-150"
}

/**
 * Normalizes original raw Excel product code string
 * Example: "00070510-150" -> codigo: "70510", dig: "150"
 * Example: "00021978-188" -> codigo: "21978", dig: "188"
 * Example: 70510 -> codigo: "70510", dig: ""
 */
export function normalizarCodigoEDig(rawCode: any, rawDig?: any): CodeDigResult {
  let str = String(rawCode || '').trim();
  if (!str) {
    return { codigo: '', dig: '', codigoOriginal: '' };
  }

  // Remove trailing decimal suffixes like .0 or ,0 if present
  if (/^\d+[.,]0+$/.test(str)) {
    str = str.split(/[.,]/)[0];
  }

  const codigoOriginal = str;

  if (str.includes('-')) {
    const parts = str.split('-');
    const partBefore = parts[0].trim().replace(/[.,]0+$/, '');
    const partAfter = parts.slice(1).join('-').trim();

    // Remove leading zeros from code
    const codigoClean = partBefore.replace(/^0+/, '') || '0';
    const digClean = partAfter;

    return {
      codigo: codigoClean,
      dig: digClean,
      codigoOriginal,
    };
  } else {
    const cleanStr = str.replace(/[.,]0+$/, '');
    const codigoClean = cleanStr.replace(/^0+/, '') || '0';
    let digClean = rawDig !== undefined && rawDig !== null ? String(rawDig).trim() : '';
    if (/^\d+[.,]0+$/.test(digClean)) {
      digClean = digClean.split(/[.,]/)[0];
    }
    return {
      codigo: codigoClean,
      dig: digClean,
      codigoOriginal,
    };
  }
}

/**
 * Normalizes header string for broad fuzzy matching
 */
export function cleanHeaderStr(str: any): string {
  return String(str || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^A-Z0-9]/g, '');      // keep alphanumeric
}

export interface ParsedEstoqueRow {
  codigo: string;
  dig: string;
  codigoOriginal: string;
  descricao: string;
  embalagem: string;
  compradorFilial: string;
  estoqueEmb1: string;
  estoqueEmb9: string;
  outrasColunas?: Record<string, any>;
}

export interface ParsedVendaRow {
  codigo: string;
  dig: string;
  codigoOriginal: string;
  venda30DiasStr: string;
  rawVenda30: any;
  outrasColunas?: Record<string, any>;
}

/**
 * Parses the Stock Spreadsheet (Planilha de Estoque)
 */
export async function parsePlanilhaEstoque(file: File): Promise<{
  sucesso: boolean;
  mensagem: string;
  rows: ParsedEstoqueRow[];
  totalLidos: number;
}> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    if (!workbook.SheetNames.length) {
      return { sucesso: false, mensagem: 'A planilha de estoque está vazia.', rows: [], totalLidos: 0 };
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: false });
    if (!matrix.length) {
      return { sucesso: false, mensagem: 'Nenhuma linha de dados encontrada na planilha de estoque.', rows: [], totalLidos: 0 };
    }

    const codigoSynonyms = ['CODIGO', 'COD', 'CODIGOMERCADORIA', 'SKU', 'ITEM', 'PLU', 'CODPROD', 'CODIGOITEM', 'MERCADORIACOD'];
    const descricaoSynonyms = ['DESCRICAOMERCADORIA', 'DESCRICAO', 'MERCADORIA', 'PRODUTO', 'DESCRICAOPRODUTO', 'NOME', 'DESCR', 'DISCRIMINACAO'];
    const embalagemSynonyms = ['EMBALAGEM', 'EMB', 'EMBAL', 'EMBALAGENS', 'UNIDADE', 'UNIDADEMEDIDA'];
    const compradorSynonyms = ['COMPRADORFILIAL', 'COMPRADOR', 'FILIAL', 'COMPRADORFIL', 'NOMECOMPRADOR'];
    const emb1Synonyms = ['ESTOQUEEMB1', 'ESTOQUE1', 'EMB1', 'ESTEMB1', 'SALDOEMB1', 'ESTOQUEEMB01'];
    const emb9Synonyms = ['ESTOQUEEMB9', 'ESTOQUE9', 'EMB9', 'ESTEMB9', 'SALDOEMB9', 'ESTOQUEEMB09'];

    let headerRowIndex = -1;
    let colIndexCodigo = -1;
    let colIndexDescricao = -1;
    let colIndexEmbalagem = -1;
    let colIndexComprador = -1;
    let colIndexEmb1 = -1;
    let colIndexEmb9 = -1;

    for (let r = 0; r < Math.min(matrix.length, 30); r++) {
      const row = matrix[r];
      if (!Array.isArray(row)) continue;

      let fCod = -1;
      let fDesc = -1;
      let fEmb = -1;
      let fComp = -1;
      let fE1 = -1;
      let fE9 = -1;

      row.forEach((cellVal, cIdx) => {
        const cleaned = cleanHeaderStr(cellVal);
        if (!cleaned) return;

        if (fCod === -1 && codigoSynonyms.some((syn) => cleaned === syn || cleaned.includes('CODIGO') || cleaned.includes('SKU'))) {
          fCod = cIdx;
        }
        if (fDesc === -1 && descricaoSynonyms.some((syn) => cleaned === syn || cleaned.includes('DESCRICAO') || cleaned.includes('MERCADORIA'))) {
          fDesc = cIdx;
        }
        if (fEmb === -1 && embalagemSynonyms.some((syn) => cleaned === syn || cleaned.includes('EMBALAGEM'))) {
          fEmb = cIdx;
        }
        if (fComp === -1 && compradorSynonyms.some((syn) => cleaned === syn || cleaned.includes('COMPRADOR'))) {
          fComp = cIdx;
        }
        if (fE1 === -1 && emb1Synonyms.some((syn) => cleaned === syn || cleaned.includes('EMB1') || cleaned.includes('ESTOQUE1'))) {
          fE1 = cIdx;
        }
        if (fE9 === -1 && emb9Synonyms.some((syn) => cleaned === syn || cleaned.includes('EMB9') || cleaned.includes('ESTOQUE9'))) {
          fE9 = cIdx;
        }
      });

      if (fCod !== -1 || fDesc !== -1) {
        headerRowIndex = r;
        colIndexCodigo = fCod;
        colIndexDescricao = fDesc;
        colIndexEmbalagem = fEmb;
        colIndexComprador = fComp;
        colIndexEmb1 = fE1;
        colIndexEmb9 = fE9;
        break;
      }
    }

    if (headerRowIndex === -1 || (colIndexCodigo === -1 && colIndexDescricao === -1)) {
      return {
        sucesso: false,
        mensagem: 'Não foi possível identificar o cabeçalho das colunas principais (CÓDIGO e DESCRIÇÃO MERCADORIA) na planilha de estoque.',
        rows: [],
        totalLidos: 0,
      };
    }

    const rawHeadersRow = matrix[headerRowIndex] || [];
    const headerNames: string[] = rawHeadersRow.map((h, i) => String(h || `Coluna_${i + 1}`).trim());

    const rows: ParsedEstoqueRow[] = [];
    for (let r = headerRowIndex + 1; r < matrix.length; r++) {
      const row = matrix[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      const rawCode = colIndexCodigo !== -1 ? row[colIndexCodigo] : '';
      if (rawCode === undefined || rawCode === null || String(rawCode).trim() === '') continue;

      const { codigo, dig, codigoOriginal } = normalizarCodigoEDig(rawCode);
      if (!codigo) continue;

      const descricao = colIndexDescricao !== -1 ? String(row[colIndexDescricao] || '').trim() : '';
      const embalagem = colIndexEmbalagem !== -1 ? String(row[colIndexEmbalagem] || '').trim() : '';
      const compradorFilial = colIndexComprador !== -1 ? String(row[colIndexComprador] || '').trim() : '';
      const estoqueEmb1 = colIndexEmb1 !== -1 ? String(row[colIndexEmb1] ?? '').trim() : '0';
      const estoqueEmb9 = colIndexEmb9 !== -1 ? String(row[colIndexEmb9] ?? '').trim() : '0';

      const outrasColunas: Record<string, any> = {};
      headerNames.forEach((headerName, cIdx) => {
        if (
          cIdx !== colIndexCodigo &&
          cIdx !== colIndexDescricao &&
          cIdx !== colIndexEmbalagem &&
          cIdx !== colIndexComprador &&
          cIdx !== colIndexEmb1 &&
          cIdx !== colIndexEmb9
        ) {
          const val = row[cIdx];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            outrasColunas[headerName] = val;
          }
        }
      });

      rows.push({
        codigo,
        dig,
        codigoOriginal,
        descricao,
        embalagem,
        compradorFilial,
        estoqueEmb1,
        estoqueEmb9,
        outrasColunas: Object.keys(outrasColunas).length > 0 ? outrasColunas : undefined,
      });
    }

    return {
      sucesso: true,
      mensagem: `${rows.length} produtos identificados na planilha de estoque.`,
      rows,
      totalLidos: rows.length,
    };
  } catch (err: any) {
    return {
      sucesso: false,
      mensagem: `Erro ao processar planilha de estoque: ${err.message || 'Arquivo inválido.'}`,
      rows: [],
      totalLidos: 0,
    };
  }
}

/**
 * Parses the 30-Day Sales Spreadsheet (Planilha de Vendas 30 Dias)
 */
export async function parsePlanilhaVendas(file: File): Promise<{
  sucesso: boolean;
  mensagem: string;
  rows: ParsedVendaRow[];
  totalLidos: number;
}> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    if (!workbook.SheetNames.length) {
      return { sucesso: false, mensagem: 'A planilha de vendas está vazia.', rows: [], totalLidos: 0 };
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: false });
    if (!matrix.length) {
      return { sucesso: false, mensagem: 'Nenhuma linha de dados encontrada na planilha de vendas.', rows: [], totalLidos: 0 };
    }

    const codigoSynonyms = ['CODIGO', 'CODIGOINTERNO', 'CODINT', 'COD', 'SKU', 'ITEM', 'PLU', 'CODPROD', 'CODIGOITEM', 'MERCADORIACOD'];
    const digSynonyms = ['DIG', 'DIGITO', 'DV', 'DIGITOVERIFICADOR'];
    const venda30DiasSynonyms = [
      'QUANTIDADEDEVENDA30DIAS',
      'QUANTIDADEVENDA30DIAS',
      'QTDVENDA30DIAS',
      'QTDEVENDA30DIAS',
      'VENDA30DIAS',
      'VENDAS30DIAS',
      'VENDA30D',
      'QTD30DIAS',
      'QTDE30DIAS',
      'VENDA30',
      'QUANTIDADE30DIAS',
      'VENDASULTIMOS30DIAS',
      'VENDAULTIMOS30DIAS',
      'VENDAS30D',
      'QTD30D',
      'QTDE30D',
      'QTDEVENDA',
      'QUANTIDADEVENDA',
    ];

    let headerRowIndex = -1;
    let colIndexCodigo = -1;
    let colIndexDig = -1;
    let colIndexVenda30Dias = -1;

    for (let r = 0; r < Math.min(matrix.length, 30); r++) {
      const row = matrix[r];
      if (!Array.isArray(row)) continue;

      let fCod = -1;
      let fDig = -1;
      let fV30 = -1;

      row.forEach((cellVal, cIdx) => {
        const cleaned = cleanHeaderStr(cellVal);
        if (!cleaned) return;

        if (fCod === -1 && codigoSynonyms.some((syn) => cleaned === syn || cleaned.includes('CODIGO') || cleaned.includes('CODINT'))) {
          fCod = cIdx;
        }
        if (fDig === -1 && digSynonyms.some((syn) => cleaned === syn)) {
          fDig = cIdx;
        }
        if (
          fV30 === -1 &&
          (venda30DiasSynonyms.some((syn) => cleaned === syn) ||
            (cleaned.includes('VENDA') && (cleaned.includes('30') || cleaned.includes('30D') || cleaned.includes('30DIAS'))))
        ) {
          fV30 = cIdx;
        }
      });

      if (fCod !== -1 && fV30 !== -1) {
        headerRowIndex = r;
        colIndexCodigo = fCod;
        colIndexDig = fDig;
        colIndexVenda30Dias = fV30;
        break;
      }
    }

    if (headerRowIndex === -1 || colIndexCodigo === -1 || colIndexVenda30Dias === -1) {
      return {
        sucesso: false,
        mensagem:
          'Não foi possível identificar as colunas CÓDIGO e QUANTIDADE DE VENDA 30 DIAS na planilha de vendas. Verifique se o arquivo possui títulos de colunas correspondentes.',
        rows: [],
        totalLidos: 0,
      };
    }

    const rawHeadersRow = matrix[headerRowIndex] || [];
    const headerNames: string[] = rawHeadersRow.map((h, i) => String(h || `Coluna_${i + 1}`).trim());

    const rows: ParsedVendaRow[] = [];
    for (let r = headerRowIndex + 1; r < matrix.length; r++) {
      const row = matrix[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      const rawCode = colIndexCodigo !== -1 ? row[colIndexCodigo] : '';
      if (rawCode === undefined || rawCode === null || String(rawCode).trim() === '') continue;

      const rawDig = colIndexDig !== -1 ? row[colIndexDig] : undefined;
      const { codigo, dig, codigoOriginal } = normalizarCodigoEDig(rawCode, rawDig);
      if (!codigo) continue;

      const rawVenda30 = row[colIndexVenda30Dias];
      const venda30DiasStr = rawVenda30 !== undefined && rawVenda30 !== null ? String(rawVenda30).trim() : '0';

      const outrasColunas: Record<string, any> = {};
      headerNames.forEach((headerName, cIdx) => {
        if (cIdx !== colIndexCodigo && cIdx !== colIndexDig && cIdx !== colIndexVenda30Dias) {
          const val = row[cIdx];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            outrasColunas[headerName] = val;
          }
        }
      });

      rows.push({
        codigo,
        dig,
        codigoOriginal,
        venda30DiasStr,
        rawVenda30,
        outrasColunas: Object.keys(outrasColunas).length > 0 ? outrasColunas : undefined,
      });
    }

    return {
      sucesso: true,
      mensagem: `${rows.length} registros de vendas identificados.`,
      rows,
      totalLidos: rows.length,
    };
  } catch (err: any) {
    return {
      sucesso: false,
      mensagem: `Erro ao processar planilha de vendas: ${err.message || 'Arquivo inválido.'}`,
      rows: [],
      totalLidos: 0,
    };
  }
}

export interface ProcessamentoResultado {
  sucesso: boolean;
  mensagem: string;
  importacaoId?: number;
  totalProdutosAtualizados: number;
  totalVendasAtualizadas: number;
  produtosMovimentadosCount: number;
}

/**
 * Main processor handling the dual spreadsheet import and cross-referencing
 */
export async function processarDuasPlanilhasExcel(
  estoqueFile: File | null,
  vendasFile: File | null,
  onProgress?: (percent: number, stageText?: string) => void
): Promise<ProcessamentoResultado> {
  if (!estoqueFile && !vendasFile) {
    return {
      sucesso: false,
      mensagem: 'Nenhum arquivo de planilha foi selecionado.',
      totalProdutosAtualizados: 0,
      totalVendasAtualizadas: 0,
      produtosMovimentadosCount: 0,
    };
  }

  try {
    onProgress?.(5, 'Iniciando leitura e validação dos arquivos...');
    await new Promise((res) => setTimeout(res, 20));

    let parsedEstoque: ParsedEstoqueRow[] = [];
    let parsedVendas: ParsedVendaRow[] = [];

    // 1. Read Stock file if present
    if (estoqueFile) {
      onProgress?.(15, 'Lendo dados da Planilha de Estoque...');
      const resEstoque = await parsePlanilhaEstoque(estoqueFile);
      if (!resEstoque.sucesso) {
        return {
          sucesso: false,
          mensagem: `Erro na Planilha de Estoque: ${resEstoque.mensagem}`,
          totalProdutosAtualizados: 0,
          totalVendasAtualizadas: 0,
          produtosMovimentadosCount: 0,
        };
      }
      parsedEstoque = resEstoque.rows;
    }

    // 2. Read Sales file if present
    if (vendasFile) {
      onProgress?.(35, 'Lendo dados da Planilha de Vendas 30 Dias...');
      const resVendas = await parsePlanilhaVendas(vendasFile);
      if (!resVendas.sucesso) {
        return {
          sucesso: false,
          mensagem: `Erro na Planilha de Vendas: ${resVendas.mensagem}`,
          totalProdutosAtualizados: 0,
          totalVendasAtualizadas: 0,
          produtosMovimentadosCount: 0,
        };
      }
      parsedVendas = resVendas.rows;
    }

    onProgress?.(50, 'Cruzando dados das planilhas e banco local...');
    await new Promise((res) => setTimeout(res, 20));

    // Map sales by code
    const vendasMap = new Map<string, ParsedVendaRow>();
    for (const v of parsedVendas) {
      vendasMap.set(v.codigo, v);
    }

    // Existing products in local DB
    const existingProductsList = await db.produtos.toArray();
    const existingProductsMap = new Map<string, Produto>(
      existingProductsList.map((p) => [p.id, p])
    );

    // Get previous import record for comparative analysis
    const ultimaImportacao = await db.importacoes.orderBy('id').last();

    const timestampStr = getFormattedTimestamp();
    const nowIso = new Date().toISOString();

    // Prepare filename for history record
    const nomesArquivos = [];
    if (estoqueFile) nomesArquivos.push(`Estoque: ${estoqueFile.name}`);
    if (vendasFile) nomesArquivos.push(`Vendas: ${vendasFile.name}`);
    const nomeArquivoGeral = nomesArquivos.join(' | ') || 'Importação Excel';

    // Register import record
    const importacaoId = await db.importacoes.add({
      nomeArquivo: nomeArquivoGeral,
      dataHora: timestampStr,
      criadoEm: nowIso,
      qtdProdutos: 0,
    });

    const produtosBatch: Produto[] = [];
    const estoqueHistoricoBatch: any[] = [];
    let totalProdutosAtualizados = 0;
    let totalVendasAtualizadas = 0;

    // SCENARIO A: Stock File provided (with or without Sales File)
    if (parsedEstoque.length > 0) {
      for (let i = 0; i < parsedEstoque.length; i++) {
        const est = parsedEstoque[i];
        const produtoId = est.codigo;
        const existingProd = existingProductsMap.get(produtoId);

        const tipoControle = identificarTipoEmbalagem(est.embalagem);
        const finalTipoControle =
          existingProd?.tipoControle && existingProd.tipoControle !== 'NAO_IDENTIFICADO'
            ? existingProd.tipoControle
            : tipoControle;

        // Check if sales file has info for this product
        const vendaRow = vendasMap.get(est.codigo);
        let finalVenda30Str = existingProd?.venda30Dias || '';
        let finalVenda30Num = existingProd?.venda30DiasNum;

        if (vendaRow) {
          totalVendasAtualizadas++;
          const parsed = parseVenda30Dias(vendaRow.rawVenda30, finalTipoControle);
          finalVenda30Str = parsed.rawStr;
          finalVenda30Num = parsed.numericVal;
        }

        // Merge extra columns
        const mergedOutrasColunas: Record<string, any> = {
          ...(existingProd?.outrasColunas || {}),
          ...(est.outrasColunas || {}),
          ...(vendaRow?.outrasColunas ? { ...vendaRow.outrasColunas } : {}),
        };

        const prodObj: Produto = {
          id: produtoId,
          codigo: est.codigo,
          dig: est.dig || existingProd?.dig || '',
          codigoOriginal: est.codigoOriginal || existingProd?.codigoOriginal || est.codigo,
          descricao: est.descricao || existingProd?.descricao || '',
          embalagem: est.embalagem || existingProd?.embalagem || '',
          tipoControle: finalTipoControle,
          compradorFilial: est.compradorFilial || existingProd?.compradorFilial || '',
          estoqueEmb1: est.estoqueEmb1,
          estoqueEmb9: est.estoqueEmb9,
          venda30Dias: finalVenda30Str,
          venda30DiasNum: finalVenda30Num,
          outrasColunas: Object.keys(mergedOutrasColunas).length > 0 ? mergedOutrasColunas : undefined,
          criadoEm: existingProd?.criadoEm || nowIso,
          atualizadoEm: nowIso,
        };

        produtosBatch.push(prodObj);
        totalProdutosAtualizados++;

        estoqueHistoricoBatch.push({
          importacaoId,
          produtoId,
          codigo: est.codigo,
          dig: prodObj.dig,
          estoqueEmb1: est.estoqueEmb1,
          estoqueEmb9: est.estoqueEmb9,
          venda30Dias: finalVenda30Str,
          venda30DiasNum: finalVenda30Num,
          dataHora: timestampStr,
        });

        if (i % 50 === 0 || i === parsedEstoque.length - 1) {
          const pct = Math.min(80, 50 + Math.round((i / parsedEstoque.length) * 30));
          onProgress?.(pct, `Cruzando produto ${i + 1} de ${parsedEstoque.length}...`);
          await new Promise((res) => setTimeout(res, 0));
        }
      }
    } else if (parsedVendas.length > 0) {
      // SCENARIO B: Only Sales File provided
      for (let i = 0; i < parsedVendas.length; i++) {
        const v = parsedVendas[i];
        const produtoId = v.codigo;
        const existingProd = existingProductsMap.get(produtoId);

        if (existingProd) {
          const { numericVal, rawStr } = parseVenda30Dias(v.rawVenda30, existingProd.tipoControle);
          const mergedOutrasColunas: Record<string, any> = {
            ...(existingProd.outrasColunas || {}),
            ...(v.outrasColunas || {}),
          };

          const prodObj: Produto = {
            ...existingProd,
            dig: v.dig || existingProd.dig,
            venda30Dias: rawStr,
            venda30DiasNum: numericVal,
            outrasColunas: Object.keys(mergedOutrasColunas).length > 0 ? mergedOutrasColunas : undefined,
            atualizadoEm: nowIso,
          };

          produtosBatch.push(prodObj);
          totalVendasAtualizadas++;
          totalProdutosAtualizados++;

          estoqueHistoricoBatch.push({
            importacaoId,
            produtoId,
            codigo: v.codigo,
            dig: prodObj.dig,
            estoqueEmb1: existingProd.estoqueEmb1,
            estoqueEmb9: existingProd.estoqueEmb9,
            venda30Dias: rawStr,
            venda30DiasNum: numericVal,
            dataHora: timestampStr,
          });
        }
      }
    }

    // Save batch to database
    onProgress?.(82, `Gravando ${produtosBatch.length} produtos no banco local...`);
    await db.produtos.bulkPut(produtosBatch);
    await db.estoqueHistorico.bulkAdd(estoqueHistoricoBatch);

    // 4. SALES CALCULATION & EXPIRATION CONTROLS (FEFO)
    // ONLY executed when both files are loaded OR when sales data is actively updated with previous history
    let produtosMovimentadosCount = 0;
    const canCalculateSales = Boolean(vendasFile || (estoqueFile && parsedVendas.length > 0));

    if (canCalculateSales && ultimaImportacao && ultimaImportacao.id) {
      onProgress?.(90, 'Comparando Venda 30 Dias e aplicando cálculo de vencimento...');

      const prevStockList = await db.estoqueHistorico
        .where('importacaoId')
        .equals(ultimaImportacao.id)
        .toArray();
      const prevStockMap = new Map(prevStockList.map((s) => [s.produtoId, s]));

      for (let i = 0; i < produtosBatch.length; i++) {
        const produtoObj = produtosBatch[i];
        const prevHist = prevStockMap.get(produtoObj.id);

        if (prevHist && produtoObj.venda30DiasNum !== undefined) {
          const prevVenda30Num =
            prevHist.venda30DiasNum !== undefined
              ? prevHist.venda30DiasNum
              : parseVenda30Dias(prevHist.venda30Dias, produtoObj.tipoControle).numericVal;
          const currVenda30Num = produtoObj.venda30DiasNum;

          const unidadesPorCaixa = extrairUnidadesPorCaixa(produtoObj.embalagem);

          // Get active expiration controls for this product
          const controlesDoProduto = await db.controleVencimento
            .where({ produtoId: produtoObj.id })
            .toArray();

          if (controlesDoProduto.length > 0) {
            if (currVenda30Num > prevVenda30Num) {
              // Rule 5 & 8: Venda Identificada = Atual - Anterior
              const vendaIdentificada = currVenda30Num - prevVenda30Num;

              // Active controls sorted by dataVencimento ASC (FEFO)
              const controlesAtivos = controlesDoProduto
                .filter((c) => c.quantidadeAtual > 0)
                .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));

              if (controlesAtivos.length > 0) {
                produtosMovimentadosCount++;
                let descontoRestante = vendaIdentificada;

                for (let cIdx = 0; cIdx < controlesAtivos.length; cIdx++) {
                  const ctrl = controlesAtivos[cIdx];
                  if (descontoRestante <= 0) break;

                  const qtdAnterior = ctrl.quantidadeAtual;
                  const valorDesconto = Math.min(qtdAnterior, descontoRestante);
                  const qtdNova = qtdAnterior - valorDesconto;
                  descontoRestante -= valorDesconto;

                  const isLastControl = cIdx === controlesAtivos.length - 1;
                  const teveExcesso = descontoRestante > 0 && isLastControl;
                  const excessoValor = teveExcesso ? descontoRestante : 0;

                  const novoStatus = calcularStatusVencimento(ctrl.dataVencimento);

                  let novoEmb1 = 0;
                  let novoEmb9 = 0;
                  if (ctrl.unidadeControle === 'PESO') {
                    novoEmb1 = Math.floor(qtdNova / 1000);
                    novoEmb9 = qtdNova % 1000;
                  } else {
                    const { emb1, emb9 } = converterUnidadesParaEmb1Emb9(
                      qtdNova,
                      ctrl.unidadesPorCaixa || unidadesPorCaixa
                    );
                    novoEmb1 = emb1;
                    novoEmb9 = emb9;
                  }

                  await db.controleVencimento.update(ctrl.id!, {
                    quantidadeAtual: qtdNova,
                    qtdEmb1: novoEmb1,
                    qtdEmb9: novoEmb9,
                    status: novoStatus,
                    venda30DiasReferencia: currVenda30Num,
                    venda30DiasStr: produtoObj.venda30Dias,
                    alertaDivergencia: teveExcesso,
                    motivoDivergencia: teveExcesso
                      ? 'A venda identificada é maior que a quantidade atualmente controlada para este vencimento.'
                      : undefined,
                    alertaMovimentacaoSuperior: teveExcesso,
                    movimentacaoExcedente: excessoValor,
                    ultimaVendaIdentificada: valorDesconto,
                    dataUltimaMovimentacao: timestampStr,
                    atualizadoEm: nowIso,
                  });

                  await db.historicoMovimentacao.add({
                    controleVencimentoId: ctrl.id!,
                    importacaoId,
                    dataHora: timestampStr,
                    estoqueAnteriorEmb1: prevHist.estoqueEmb1,
                    estoqueAnteriorEmb9: prevHist.estoqueEmb9,
                    estoqueAtualEmb1: produtoObj.estoqueEmb1,
                    estoqueAtualEmb9: produtoObj.estoqueEmb9,
                    venda30DiasAnterior: prevHist.venda30Dias || String(prevVenda30Num),
                    venda30DiasAtual: produtoObj.venda30Dias || String(currVenda30Num),
                    vendaIdentificada,
                    movimentacaoIdentificada: vendaIdentificada,
                    quantidadeAnterior: qtdAnterior,
                    quantidadeNova: qtdNova,
                    alertaDivergencia: teveExcesso,
                    motivoDivergencia: teveExcesso
                      ? 'A venda identificada é maior que a quantidade atualmente controlada para este vencimento.'
                      : undefined,
                    alertaMovimentacaoSuperior: teveExcesso,
                    movimentacaoExcedente: excessoValor,
                  });
                }
              }
            } else if (currVenda30Num < prevVenda30Num) {
              // Rule 6: Sales 30 days decreased (mobile window) -> Alert divergence, do not discount
              const motivo =
                'A quantidade de venda dos últimos 30 dias diminuiu em relação à importação anterior. Como este indicador utiliza uma janela móvel de 30 dias, não é possível determinar automaticamente a venda do período.';

              for (const ctrl of controlesDoProduto) {
                await db.controleVencimento.update(ctrl.id!, {
                  venda30DiasReferencia: currVenda30Num,
                  venda30DiasStr: produtoObj.venda30Dias,
                  alertaDivergencia: true,
                  motivoDivergencia: motivo,
                  dataUltimaMovimentacao: timestampStr,
                  atualizadoEm: nowIso,
                });

                await db.historicoMovimentacao.add({
                  controleVencimentoId: ctrl.id!,
                  importacaoId,
                  dataHora: timestampStr,
                  estoqueAnteriorEmb1: prevHist.estoqueEmb1,
                  estoqueAnteriorEmb9: prevHist.estoqueEmb9,
                  estoqueAtualEmb1: produtoObj.estoqueEmb1,
                  estoqueAtualEmb9: produtoObj.estoqueEmb9,
                  venda30DiasAnterior: prevHist.venda30Dias || String(prevVenda30Num),
                  venda30DiasAtual: produtoObj.venda30Dias || String(currVenda30Num),
                  vendaIdentificada: 0,
                  movimentacaoIdentificada: 0,
                  quantidadeAnterior: ctrl.quantidadeAtual,
                  quantidadeNova: ctrl.quantidadeAtual,
                  alertaDivergencia: true,
                  motivoDivergencia: motivo,
                });
              }
            } else {
              // Sales unchanged
              for (const ctrl of controlesDoProduto) {
                await db.controleVencimento.update(ctrl.id!, {
                  venda30DiasReferencia: currVenda30Num,
                  venda30DiasStr: produtoObj.venda30Dias,
                  alertaDivergencia: false,
                  motivoDivergencia: undefined,
                  atualizadoEm: nowIso,
                });
              }
            }
          }
        }
      }
    }

    // Update import record count
    await db.importacoes.update(importacaoId, {
      qtdProdutos: totalProdutosAtualizados,
    });

    onProgress?.(100, 'Processamento concluído com sucesso!');
    await new Promise((res) => setTimeout(res, 150));

    let msg = `Processamento concluído! ${totalProdutosAtualizados} produtos atualizados`;
    if (totalVendasAtualizadas > 0) {
      msg += ` (${totalVendasAtualizadas} com dados de Venda 30 Dias)`;
    }
    msg += '.';

    return {
      sucesso: true,
      mensagem: msg,
      importacaoId,
      totalProdutosAtualizados,
      totalVendasAtualizadas,
      produtosMovimentadosCount,
    };
  } catch (err: any) {
    console.error('Erro no processamento das planilhas:', err);
    onProgress?.(100, 'Erro durante o processamento.');
    return {
      sucesso: false,
      mensagem: `Erro ao processar planilhas: ${err.message || 'Falha no processamento.'}`,
      totalProdutosAtualizados: 0,
      totalVendasAtualizadas: 0,
      produtosMovimentadosCount: 0,
    };
  }
}

/**
 * Downloads Sample Stock Spreadsheet (.xlsx)
 */
export function baixarModeloPlanilhaEstoque() {
  const exampleData = [
    {
      'CÓDIGO': '00070510-150',
      'DESCRIÇÃO MERCADORIA': 'MORTADELA AURORA TRADICIONAL 1KG',
      'EMBALAGEM': 'KG 1 X 1000 X 1G',
      'COMPRADOR FILIAL': 'JOAO SILVA - MATRIZ',
      'ESTOQUE EMB1': '150,500',
      'ESTOQUE EMB9': '0,500',
      'DATA ÚLTIMA ENTRADA': '10/08/2026',
      'QUANTIDADE ÚLTIMA ENTRADA': '50',
      'FORNECEDOR': 'AURORA ALIMENTOS',
      'CATEGORIA': 'FROZEN & CHILLED',
    },
    {
      'CÓDIGO': '00021978-188',
      'DESCRIÇÃO MERCADORIA': 'LINGUICA CALABRESA SADIA DEFUMADA 2,5KG',
      'EMBALAGEM': 'KG 1 X 1000 X 1G',
      'COMPRADOR FILIAL': 'CARLOS SOUZA - FILIAL 01',
      'ESTOQUE EMB1': '85,000',
      'ESTOQUE EMB9': '12,000',
      'DATA ÚLTIMA ENTRADA': '08/08/2026',
      'QUANTIDADE ÚLTIMA ENTRADA': '30',
      'FORNECEDOR': 'BRF S.A.',
      'CATEGORIA': 'EMBUTIDOS',
    },
    {
      'CÓDIGO': '00088123-010',
      'DESCRIÇÃO MERCADORIA': 'QUEIJO MUSSARELA ITAMBÉ PEDAÇO 500G',
      'EMBALAGEM': 'CXA 1 X 15 X 400G',
      'COMPRADOR FILIAL': 'MARIA LIMA - FILIAL 02',
      'ESTOQUE EMB1': '150',
      'ESTOQUE EMB9': '20',
      'DATA ÚLTIMA ENTRADA': '12/08/2026',
      'QUANTIDADE ÚLTIMA ENTRADA': '100',
      'FORNECEDOR': 'LATICINIOS ITAMBE',
      'CATEGORIA': 'LATICINIOS',
    },
    {
      'CÓDIGO': '00045612-001',
      'DESCRIÇÃO MERCADORIA': 'LINGUICA FININHA SADIA 170G',
      'EMBALAGEM': 'CXA 1 X 20 X 170G',
      'COMPRADOR FILIAL': 'MARIA LIMA - FILIAL 02',
      'ESTOQUE EMB1': '10',
      'ESTOQUE EMB9': '15',
      'DATA ÚLTIMA ENTRADA': '05/08/2026',
      'QUANTIDADE ÚLTIMA ENTRADA': '20',
      'FORNECEDOR': 'BRF S.A.',
      'CATEGORIA': 'EMBUTIDOS',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(exampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Estoque');

  ws['!cols'] = [
    { wch: 16 }, // CÓDIGO
    { wch: 45 }, // DESCRIÇÃO
    { wch: 22 }, // EMBALAGEM
    { wch: 28 }, // COMPRADOR FILIAL
    { wch: 15 }, // ESTOQUE EMB1
    { wch: 15 }, // ESTOQUE EMB9
    { wch: 22 }, // DATA ULTIMA ENTRADA
    { wch: 26 }, // QUANTIDADE ULTIMA ENTRADA
    { wch: 25 }, // FORNECEDOR
    { wch: 20 }, // CATEGORIA
  ];

  XLSX.writeFile(wb, 'Modelo_Planilha_Estoque.xlsx');
}

/**
 * Downloads Sample Sales Spreadsheet based on official SASOI061 standard (.xlsx)
 */
export function baixarModeloPlanilhaVendas() {
  const exampleData = [
    {
      'NR.PDV': '502',
      'NR.CUPOM': '636613',
      'OPERADOR': '1042',
      'DT.VENDA': '14/08/2026',
      'CNPJ ATACADAO': '00.000.000/0001-00',
      'CNPJ CLIENTE': '',
      'SEQ': '1',
      'CODIGO': '00084906-980',
      'DESCRICAO MERCADORIA': 'BISCOITO RECHEADO CHOCOLATE 200G',
      'HORA': '15:12',
      'TRIB.': 'FF',
      'STA.': '',
      'EMBALAGEM': 'UND 1 X 1 X 200G',
      'LEITURA': 'EAN',
      'QTD.': '38',
      'VLR.UNIT.': '3,49',
      'VALOR': '132,62',
      'PR.ATUAL': '3,49',
    },
    {
      'NR.PDV': '502',
      'NR.CUPOM': '636613',
      'OPERADOR': '1042',
      'DT.VENDA': '14/08/2026',
      'CNPJ ATACADAO': '00.000.000/0001-00',
      'CNPJ CLIENTE': '',
      'SEQ': '2',
      'CODIGO': '00084906-192',
      'DESCRICAO MERCADORIA': 'BISCOITO RECHEADO CHOCOLATE 200G CXA',
      'HORA': '15:12',
      'TRIB.': 'FF',
      'STA.': '',
      'EMBALAGEM': 'CXA 1 X 27 X 200G',
      'LEITURA': 'EAN',
      'QTD.': '2',
      'VLR.UNIT.': '89,90',
      'VALOR': '179,80',
      'PR.ATUAL': '89,90',
    },
    {
      'NR.PDV': '504',
      'NR.CUPOM': '741258',
      'OPERADOR': '2015',
      'DT.VENDA': '14/08/2026',
      'CNPJ ATACADAO': '00.000.000/0001-00',
      'CNPJ CLIENTE': '',
      'SEQ': '1',
      'CODIGO': '00034512-001',
      'DESCRICAO MERCADORIA': 'WAFER CHOCOLATE 85G CXA',
      'HORA': '16:40',
      'TRIB.': 'FF',
      'STA.': '',
      'EMBALAGEM': 'CXA 6 X 12 X 85G',
      'LEITURA': 'DUN14',
      'QTD.': '2',
      'VLR.UNIT.': '144,00',
      'VALOR': '288,00',
      'PR.ATUAL': '144,00',
    },
    {
      'NR.PDV': '506',
      'NR.CUPOM': '852963',
      'OPERADOR': '3001',
      'DT.VENDA': '14/08/2026',
      'CNPJ ATACADAO': '00.000.000/0001-00',
      'CNPJ CLIENTE': '',
      'SEQ': '1',
      'CODIGO': '00070510-150',
      'DESCRICAO MERCADORIA': 'MORTADELA OURO TRADICIONAL 1KG',
      'HORA': '17:20',
      'TRIB.': 'FF',
      'STA.': '',
      'EMBALAGEM': 'GR 1 X 1 X 1G',
      'LEITURA': 'PESO',
      'QTD.': '3590',
      'VLR.UNIT.': '0,0249',
      'VALOR': '89,39',
      'PR.ATUAL': '24,90',
    },
    {
      'NR.PDV': '506',
      'NR.CUPOM': '852964',
      'OPERADOR': '3001',
      'DT.VENDA': '14/08/2026',
      'CNPJ ATACADAO': '00.000.000/0001-00',
      'CNPJ CLIENTE': '',
      'SEQ': '1',
      'CODIGO': '00070510-150',
      'DESCRICAO MERCADORIA': 'MORTADELA OURO TRADICIONAL 1KG',
      'HORA': '17:25',
      'TRIB.': 'FF',
      'STA.': '',
      'EMBALAGEM': 'GR 1 X 1 X 1G',
      'LEITURA': 'PESO',
      'QTD.': '975',
      'VLR.UNIT.': '0,0249',
      'VALOR': '24,28',
      'PR.ATUAL': '24,90',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(exampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'SASOI061');

  ws['!cols'] = [
    { wch: 10 }, // NR.PDV
    { wch: 12 }, // NR.CUPOM
    { wch: 10 }, // OPERADOR
    { wch: 12 }, // DT.VENDA
    { wch: 22 }, // CNPJ ATACADAO
    { wch: 18 }, // CNPJ CLIENTE
    { wch: 6 },  // SEQ
    { wch: 16 }, // CODIGO
    { wch: 38 }, // DESCRICAO MERCADORIA
    { wch: 8 },  // HORA
    { wch: 8 },  // TRIB.
    { wch: 8 },  // STA.
    { wch: 20 }, // EMBALAGEM
    { wch: 10 }, // LEITURA
    { wch: 10 }, // QTD.
    { wch: 12 }, // VLR.UNIT.
    { wch: 12 }, // VALOR
    { wch: 12 }, // PR.ATUAL
  ];

  XLSX.writeFile(wb, 'Modelo_Relatorio_Vendas_SASOI061.xlsx');
}

export interface ParsedEanRow {
  ean: string;
  codigo: string;
  dig: string;
  codigoOriginal: string;
  descricao?: string;
}

/**
 * Normalizes barcode / EAN value from any Excel data type
 */
export function normalizarEan(rawEan: any): string {
  if (rawEan === undefined || rawEan === null) return '';
  let str = String(rawEan).trim();
  if (!str) return '';

  // Handle scientific notation e.g. 7.89123456789E+12
  if (/[eE][+-]?\d+/.test(str)) {
    try {
      const num = Number(rawEan);
      if (!isNaN(num)) {
        str = BigInt(Math.round(num)).toString();
      }
    } catch {
      // fallback to raw string
    }
  }

  // Handle number formatted as decimal e.g. "7891234567890.0"
  if (/^\d+[.,]0+$/.test(str)) {
    str = str.split(/[.,]/)[0];
  }

  // Remove spaces, dashes, quotes, and punctuation except alphanumeric
  const clean = str.replace(/[^0-9A-Za-z]/g, '').trim();
  return clean;
}

/**
 * Parses the EAN / Barcode Vinculation Spreadsheet
 */
export async function parsePlanilhaVinculosEan(file: File): Promise<{
  sucesso: boolean;
  mensagem: string;
  rows: ParsedEanRow[];
  totalLidos: number;
}> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    if (!workbook.SheetNames.length) {
      return { sucesso: false, mensagem: 'A planilha está vazia.', rows: [], totalLidos: 0 };
    }

    const eanSynonyms = [
      'EAN',
      'GTIN',
      'CODIGODEBARRAS',
      'CODIGOBARRAS',
      'CODBARRAS',
      'BARRAS',
      'BARCODE',
      'EAN13',
      'EANTRIB',
      'EAN14',
      'CODIGOBARRA',
      'CODBARRA',
      'CODBARRASPRODUTO',
      'CODBARRASITEM',
      'CODIGODEBARRASEAN',
      'CODIGOBARRASEAN',
      'EANPRODUTO',
      'EANITEM',
      'GTIN13',
      'GTIN14',
    ];
    const codigoSynonyms = [
      'CODIGOINTERNO',
      'CODINTERNO',
      'CODIGOMERCADORIA',
      'CODIGO',
      'COD',
      'CODPROD',
      'CODIGOPRODUTO',
      'SKU',
      'PLU',
      'ITEM',
      'REF',
      'REFERENCIA',
      'MERCADORIACOD',
      'CODPRODUTO',
      'CODIGOMERC',
    ];
    const digSynonyms = [
      'DIG',
      'DIGITO',
      'DIGITOVERIFICADOR',
      'DIGVERIF',
      'DV',
      'DIGITOITEM',
      'DIGITOOPCIONAL',
      'DIGOPCIONAL',
    ];
    const descricaoSynonyms = [
      'DESCRICAO',
      'DESCRICAOMERCADORIA',
      'DESCRICAOPRODUTO',
      'PRODUTO',
      'NOME',
      'DESCR',
      'MERCADORIA',
      'DESCRICAOOPCIONAL',
      'NOMEMERCADORIA',
      'DESCRICAOITEM',
    ];

    let foundRows: ParsedEanRow[] = [];

    // Scan sheets to find the one containing EAN headers
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: false });
      if (!matrix.length) continue;

      let headerRowIndex = -1;
      let colIndexEan = -1;
      let colIndexCodigo = -1;
      let colIndexDig = -1;
      let colIndexDescricao = -1;

      for (let r = 0; r < Math.min(matrix.length, 35); r++) {
        const row = matrix[r];
        if (!Array.isArray(row)) continue;

        let fEan = -1;
        let fCod = -1;
        let fDig = -1;
        let fDesc = -1;

        // First pass: identify EAN / Barcode column explicitly (any column mentioning EAN, GTIN, BARRA, BARCODE)
        row.forEach((cellVal, cIdx) => {
          const cleaned = cleanHeaderStr(cellVal);
          if (!cleaned) return;

          const isEanHeader =
            cleaned.includes('EAN') ||
            cleaned.includes('BARRA') ||
            cleaned.includes('GTIN') ||
            cleaned.includes('BARCODE') ||
            eanSynonyms.includes(cleaned);

          if (isEanHeader && fEan === -1) {
            fEan = cIdx;
          }
        });

        // Second pass: identify Code, Dig, Description (avoiding the EAN column)
        row.forEach((cellVal, cIdx) => {
          if (cIdx === fEan) return; // Cannot be the EAN column
          const cleaned = cleanHeaderStr(cellVal);
          if (!cleaned) return;

          const isDigHeader =
            cleaned === 'DIG' ||
            cleaned === 'DIGITO' ||
            cleaned.includes('DIGITO') ||
            cleaned === 'DV' ||
            digSynonyms.includes(cleaned);

          const isDescHeader =
            cleaned.includes('DESCRICAO') ||
            cleaned.includes('PRODUTO') ||
            cleaned.includes('MERCADORIA') ||
            cleaned.includes('NOME') ||
            descricaoSynonyms.includes(cleaned);

          const isCodHeader =
            cleaned.includes('CODIGO') ||
            cleaned.includes('INTERNO') ||
            cleaned.includes('SKU') ||
            cleaned.includes('ITEM') ||
            cleaned === 'COD' ||
            cleaned === 'PLU' ||
            cleaned === 'REF' ||
            codigoSynonyms.includes(cleaned);

          if (isDigHeader && fDig === -1) {
            fDig = cIdx;
          } else if (isDescHeader && fDesc === -1) {
            fDesc = cIdx;
          } else if (isCodHeader && fCod === -1) {
            fCod = cIdx;
          }
        });

        // If we found both EAN and CODIGO and they are distinct columns
        if (fEan !== -1 && fCod !== -1 && fEan !== fCod) {
          headerRowIndex = r;
          colIndexEan = fEan;
          colIndexCodigo = fCod;
          colIndexDig = fDig;
          colIndexDescricao = fDesc;
          break;
        }
      }

      // Fallback: If no explicit headers found in this sheet, check if row 0 has data (col 0 = EAN, col 1 = Codigo)
      if (headerRowIndex === -1 && matrix.length > 0 && matrix[0].length >= 2) {
        // Test first row if it looks like barcode & code
        const testEan = normalizarEan(matrix[0][0]);
        const testCod = String(matrix[0][1] || '').trim();
        if (testEan && testCod) {
          headerRowIndex = -1; // row 0 is already data
          colIndexEan = 0;
          colIndexCodigo = 1;
          colIndexDig = matrix[0].length >= 3 ? 2 : -1;
          colIndexDescricao = matrix[0].length >= 4 ? 3 : -1;
        }
      }

      if (colIndexEan !== -1 && colIndexCodigo !== -1) {
        const rows: ParsedEanRow[] = [];
        const startIndex = headerRowIndex === -1 ? 0 : headerRowIndex + 1;

        for (let r = startIndex; r < matrix.length; r++) {
          const row = matrix[r];
          if (!Array.isArray(row) || row.length === 0) continue;

          const rawEan = colIndexEan !== -1 ? row[colIndexEan] : '';
          const rawCod = colIndexCodigo !== -1 ? row[colIndexCodigo] : '';
          const rawDig = colIndexDig !== -1 ? row[colIndexDig] : '';
          const rawDesc = colIndexDescricao !== -1 ? String(row[colIndexDescricao] || '').trim() : '';

          const ean = normalizarEan(rawEan);
          const { codigo, dig, codigoOriginal } = normalizarCodigoEDig(rawCod, rawDig);

          if (!ean || !codigo) continue;

          rows.push({
            ean,
            codigo,
            dig,
            codigoOriginal,
            descricao: rawDesc,
          });
        }

        if (rows.length > 0) {
          foundRows = rows;
          break;
        }
      }
    }

    if (foundRows.length === 0) {
      return {
        sucesso: false,
        mensagem: 'Não foi possível identificar as colunas de "Código de Barras (EAN)" e "Código Interno" na planilha.',
        rows: [],
        totalLidos: 0,
      };
    }

    return {
      sucesso: true,
      mensagem: `${foundRows.length} vínculos EAN identificados na planilha.`,
      rows: foundRows,
      totalLidos: foundRows.length,
    };
  } catch (err: any) {
    console.error('Erro ao ler planilha de vínculos EAN:', err);
    return {
      sucesso: false,
      mensagem: `Erro ao processar arquivo: ${err.message || 'Arquivo inválido.'}`,
      rows: [],
      totalLidos: 0,
    };
  }
}

export interface ResultadoImportacaoVinculosEan {
  sucesso: boolean;
  mensagem: string;
  totalLidos: number;
  totalVinculados: number;
  produtosExistentes: number;
  produtosNovosSemCatalogo: number;
  duplicadosNoArquivo: number;
}

/**
 * Processes and saves EAN Vinculation Spreadsheet directly to IndexedDB
 */
export async function processarImportacaoVinculosEan(
  file: File,
  onProgress?: (percent: number, stageText?: string) => void,
  opcoes?: { limparBaseAntiga?: boolean }
): Promise<ResultadoImportacaoVinculosEan> {
  try {
    onProgress?.(10, 'Lendo arquivo de vínculos EAN...');
    const parsed = await parsePlanilhaVinculosEan(file);
    if (!parsed.sucesso || parsed.rows.length === 0) {
      return {
        sucesso: false,
        mensagem: parsed.mensagem,
        totalLidos: 0,
        totalVinculados: 0,
        produtosExistentes: 0,
        produtosNovosSemCatalogo: 0,
        duplicadosNoArquivo: 0,
      };
    }

    if (opcoes?.limparBaseAntiga) {
      onProgress?.(20, 'Apagando base de vínculos EAN anterior...');
      await db.vinculosEan.clear();
    }

    onProgress?.(30, 'Carregando catálogo de produtos para cruzamento...');
    const todosProdutos = await db.produtos.toArray();
    const produtosMap = new Map<string, Produto>();

    todosProdutos.forEach((p) => {
      if (p.id) produtosMap.set(p.id, p);
      if (p.codigo) produtosMap.set(p.codigo, p);
      if (p.codigoOriginal) produtosMap.set(p.codigoOriginal, p);
      const cleanCod = p.codigo.replace(/^0+/, '');
      if (cleanCod) produtosMap.set(cleanCod, p);
    });

    onProgress?.(50, 'Organizando e deduplicando vínculos...');
    const eanMap = new Map<string, ParsedEanRow>();
    let duplicadosNoArquivo = 0;

    parsed.rows.forEach((row) => {
      if (eanMap.has(row.ean)) {
        duplicadosNoArquivo++;
      }
      eanMap.set(row.ean, row);
    });

    onProgress?.(70, `Gravando ${eanMap.size} vínculos no banco de dados...`);
    const nowIso = new Date().toISOString();
    let produtosExistentes = 0;
    let produtosNovosSemCatalogo = 0;

    // Fetch existing links
    const existingLinks = await db.vinculosEan.toArray();
    const existingLinksMap = new Map<string, number>(); // ean -> id
    existingLinks.forEach((l) => {
      if (l.id) existingLinksMap.set(l.ean, l.id);
    });

    const entriesToSave = Array.from(eanMap.values());
    const totalEntries = entriesToSave.length;

    // Process in batches
    const batchSize = 250;
    for (let i = 0; i < totalEntries; i += batchSize) {
      const batch = entriesToSave.slice(i, i + batchSize);

      await db.transaction('rw', [db.vinculosEan, db.produtos], async () => {
        for (const item of batch) {
          const cleanCod = item.codigo.replace(/^0+/, '');
          const prodCatalog =
            produtosMap.get(item.codigo) ||
            produtosMap.get(cleanCod) ||
            (item.codigoOriginal ? produtosMap.get(item.codigoOriginal) : undefined);

          let resolvedProdutoId = item.codigo;
          let resolvedDescricao = item.descricao;
          let resolvedDig = item.dig;
          let resolvedCodigoOriginal = item.codigoOriginal;

          if (prodCatalog) {
            produtosExistentes++;
            resolvedProdutoId = prodCatalog.id;
            resolvedDescricao = prodCatalog.descricao || item.descricao;
            resolvedDig = prodCatalog.dig || item.dig;
            resolvedCodigoOriginal = prodCatalog.codigoOriginal || item.codigoOriginal;
          } else {
            produtosNovosSemCatalogo++;
            // Automatically insert placeholder in db.produtos so all queries and scanners immediately recognize it!
            const existingProd = await db.produtos.get(item.codigo);
            if (!existingProd) {
              const codOrig =
                item.codigoOriginal ||
                (item.dig ? `00000000${item.codigo}`.slice(-8) + `-${item.dig}` : item.codigo);
              const desc = item.descricao || `PRODUTO CÓDIGO ${item.codigo}${item.dig ? '-' + item.dig : ''}`;

              await db.produtos.put({
                id: item.codigo,
                codigo: item.codigo,
                dig: item.dig || '',
                codigoOriginal: codOrig,
                descricao: desc,
                embalagem: 'UNIDADE',
                tipoControle: 'UNIDADE',
                compradorFilial: 'VÍNCULO EAN',
                estoqueEmb1: '0',
                estoqueEmb9: '0',
                criadoEm: nowIso,
                atualizadoEm: nowIso,
              });
              resolvedCodigoOriginal = codOrig;
              resolvedDescricao = desc;
            }
          }

          const existingId = existingLinksMap.get(item.ean);
          if (existingId) {
            await db.vinculosEan.update(existingId, {
              produtoId: resolvedProdutoId,
              codigo: item.codigo,
              dig: resolvedDig,
              codigoOriginal: resolvedCodigoOriginal,
              descricao: resolvedDescricao,
              atualizadoEm: nowIso,
            });
          } else {
            await db.vinculosEan.add({
              ean: item.ean,
              produtoId: resolvedProdutoId,
              codigo: item.codigo,
              dig: resolvedDig,
              codigoOriginal: resolvedCodigoOriginal,
              descricao: resolvedDescricao,
              criadoEm: nowIso,
              atualizadoEm: nowIso,
            });
          }
        }
      });

      const currentProgress = 70 + Math.floor(((i + batch.length) / totalEntries) * 28);
      onProgress?.(currentProgress, `Gravando vínculos (${i + batch.length}/${totalEntries})...`);
    }

    onProgress?.(100, 'Importação de vínculos concluída com sucesso!');

    return {
      sucesso: true,
      mensagem: `${eanMap.size} códigos de barras (EAN) vinculados aos códigos internos com sucesso!`,
      totalLidos: parsed.totalLidos,
      totalVinculados: eanMap.size,
      produtosExistentes,
      produtosNovosSemCatalogo,
      duplicadosNoArquivo,
    };
  } catch (err: any) {
    console.error('Erro ao processar importação de vínculos EAN:', err);
    onProgress?.(100, 'Erro durante o processamento.');
    return {
      sucesso: false,
      mensagem: `Erro ao processar planilha de vínculos EAN: ${err.message || 'Falha no processamento.'}`,
      totalLidos: 0,
      totalVinculados: 0,
      produtosExistentes: 0,
      produtosNovosSemCatalogo: 0,
      duplicadosNoArquivo: 0,
    };
  }
}

/**
 * Downloads Sample EAN Vinculation Spreadsheet (.xlsx)
 */
export function baixarModeloPlanilhaVinculoEan() {
  const exampleData = [
    {
      'CÓDIGO DE BARRAS / EAN': '7894900011517',
      'CÓDIGO INTERNO': '70510',
      'DÍGITO (OPCIONAL)': '150',
      'DESCRIÇÃO (OPCIONAL)': 'MORTADELA AURORA TRADICIONAL 1KG',
    },
    {
      'CÓDIGO DE BARRAS / EAN': '7891000100103',
      'CÓDIGO INTERNO': '21978',
      'DÍGITO (OPCIONAL)': '188',
      'DESCRIÇÃO (OPCIONAL)': 'LINGUICA CALABRESA SADIA DEFUMADA 2,5KG',
    },
    {
      'CÓDIGO DE BARRAS / EAN': '7896005800124',
      'CÓDIGO INTERNO': '88123',
      'DÍGITO (OPCIONAL)': '010',
      'DESCRIÇÃO (OPCIONAL)': 'QUEIJO MUSSARELA ITAMBÉ PEDAÇO 500G',
    },
    {
      'CÓDIGO DE BARRAS / EAN': '7891515432109',
      'CÓDIGO INTERNO': '45612',
      'DÍGITO (OPCIONAL)': '001',
      'DESCRIÇÃO (OPCIONAL)': 'LINGUICA FININHA SADIA 170G',
    },
    {
      'CÓDIGO DE BARRAS / EAN': '7891025114562',
      'CÓDIGO INTERNO': '00033456-020',
      'DÍGITO (OPCIONAL)': '',
      'DESCRIÇÃO (OPCIONAL)': 'IOGURTE BATAVO MORANGO 170G',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(exampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'VinculosEAN');

  ws['!cols'] = [
    { wch: 26 }, // CÓDIGO DE BARRAS / EAN
    { wch: 20 }, // CÓDIGO INTERNO
    { wch: 20 }, // DÍGITO
    { wch: 45 }, // DESCRIÇÃO
  ];

  XLSX.writeFile(wb, 'Modelo_Planilha_Vinculo_EAN.xlsx');
}

/**
 * Exports all existing EAN bindings from database to Excel (.xlsx)
 */
export async function exportarVinculosEanExcel() {
  const vinculos = await db.vinculosEan.toArray();
  const produtos = await db.produtos.toArray();
  const produtosMap = new Map<string, Produto>();
  produtos.forEach((p) => {
    produtosMap.set(p.id, p);
    produtosMap.set(p.codigo, p);
  });

  const exportData = vinculos.map((v) => {
    const prod = produtosMap.get(v.produtoId) || produtosMap.get(v.codigo);
    return {
      'CÓDIGO DE BARRAS / EAN': v.ean,
      'CÓDIGO INTERNO': v.codigo,
      'DÍGITO': v.dig || (prod ? prod.dig : ''),
      'DESCRIÇÃO PRODUTO': prod ? prod.descricao : '—',
      'COMPRADOR': prod ? prod.compradorFilial : '—',
      'STATUS NO CATÁLOGO': prod ? 'VINCULADO' : 'CÓDIGO SEM CADASTRO DE ESTOQUE',
      'DATA CADASTRO': v.criadoEm ? new Date(v.criadoEm).toLocaleDateString('pt-BR') : '—',
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportData.length ? exportData : [{ 'MENSAGEM': 'Nenhum vínculo cadastrado no momento.' }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'VinculosEAN');

  ws['!cols'] = [
    { wch: 26 },
    { wch: 18 },
    { wch: 10 },
    { wch: 45 },
    { wch: 25 },
    { wch: 32 },
    { wch: 16 },
  ];

  XLSX.writeFile(wb, `Base_Vinculos_EAN_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Backward compatibility alias
 */
export const processarImportacaoExcel = async (
  file: File,
  onProgress?: (percent: number, stageText?: string) => void
) => {
  return processarDuasPlanilhasExcel(file, null, onProgress);
};

export const baixarPlanilhaExemplo = baixarModeloPlanilhaEstoque;


