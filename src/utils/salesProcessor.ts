import * as XLSX from 'xlsx';
import { db } from '../db/database';
import type {
  VendaReal,
  DivergenciaVenda,
  AuditoriaFefo,
  ResumoImportacaoVendas,
  StatusVendaReal,
  ControleVencimento,
  Produto,
} from '../types';
import { normalizarCodigoEDig, cleanHeaderStr } from './excel';
import {
  normalizarQuantidadeVenda,
  gerarSaleId,
  parseDataHoraVenda,
} from './salesNormalizer';
import { formatarDataBR } from './date';
import { converterUnidadesParaEmb1Emb9 } from './packaging';
import { calcularStatusVencimento } from './date';

export interface RawVendaSASOIRow {
  pdv: string;
  cupom: string;
  operador: string;
  dtVenda: any;
  cnpjAtacadao: string;
  cnpjCliente: string;
  seq: string;
  codigoRaw: any;
  descricaoMercadoria: string;
  horaRaw: any;
  trib: string;
  sta: string;
  embalagemRaw: string;
  leitura: string;
  qtdRaw: any;
  vlrUnit: number;
  valor: number;
  prAtual: number;
  outrasColunas?: Record<string, any>;
}

/**
 * Flexible parser for the real sales report (SASOI061.xlsx or equivalent format)
 */
export async function parsePlanilhaVendasReaisSASOI061(file: File): Promise<{
  sucesso: boolean;
  mensagem: string;
  rows: RawVendaSASOIRow[];
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

    // Synonyms mapping according to SASOI061 standard
    const pdvSynonyms = ['NRPDV', 'PDV', 'NR.PDV', 'CAIXA', 'CHECKOUT', 'NUMEROPDV'];
    const cupomSynonyms = ['NRCUPOM', 'CUPOM', 'NR.CUPOM', 'NUMEROCUPOM', 'DOC', 'COO', 'CUPOMFISCAL', 'NOTA'];
    const operadorSynonyms = ['OPERADOR', 'OPERADORA', 'OP', 'USUARIO'];
    const dtVendaSynonyms = ['DTVENDA', 'DT.VENDA', 'DATAVENDA', 'DATA', 'DT_VENDA', 'EMISSAO'];
    const cnpjAtacadaoSynonyms = ['CNPJATACADAO', 'CNPJ_FILIAL', 'CNPJFILIAL', 'CNPJEMPRESA', 'CNPJLOJA', 'FILIAL', 'CNPJ'];
    const cnpjClienteSynonyms = ['CNPJCLIENTE', 'CPFCLIENTE', 'CLIENTE', 'CPFCNPJ', 'CPF_CNPJ_CLIENTE'];
    const seqSynonyms = ['SEQ', 'SEQUENCIA', 'ITEM', 'NRITEM', 'NUMEROITEM', 'ORDEM', 'LINHA'];
    const codigoSynonyms = ['CODIGO', 'COD', 'CODIGOMERCADORIA', 'SKU', 'ITEM', 'CODPROD', 'PLU', 'CODIGOITEM', 'CODINT'];
    const descricaoSynonyms = ['DESCRICAOMERCADORIA', 'DESCRICAO', 'MERCADORIA', 'PRODUTO', 'DESCR', 'NOME'];
    const horaSynonyms = ['HORA', 'HR', 'HORARIO', 'HORAVENDA', 'TIME'];
    const tribSynonyms = ['TRIB', 'TRIB.', 'TRIBUTACAO', 'TRIBUTO', 'SITTRIB'];
    const staSynonyms = ['STA', 'STA.', 'STATUS', 'ST'];
    const embalagemSynonyms = ['EMBALAGEM', 'EMB', 'UNIDADE', 'UN', 'EMBALAGEMMERCADORIA'];
    const leituraSynonyms = ['LEITURA', 'TIPO_LEITURA', 'TIPO', 'FORMA_LEITURA'];
    const qtdSynonyms = ['QTD', 'QTD.', 'QTDE', 'QUANTIDADE', 'QUANT', 'QTDVENDIDA', 'QUANTIDADEVENDIDA'];
    const vlrUnitSynonyms = ['VLRUNIT', 'VLR.UNIT', 'VLR.UNIT.', 'VALORUNITARIO', 'PRECOUNITARIO', 'PRUNIT'];
    const valorSynonyms = ['VALOR', 'VALORTOTAL', 'VLRTOTAL', 'TOTAL', 'VALORLIQUIDO', 'VALORBRUTO'];
    const prAtualSynonyms = ['PRATUAL', 'PR.ATUAL', 'PR.ATUAL.', 'PRECOATUAL', 'PRECOCADASTRO', 'PRTABELA'];

    let headerRowIndex = -1;
    let colPdv = -1;
    let colCupom = -1;
    let colOperador = -1;
    let colDtVenda = -1;
    let colCnpjAtacadao = -1;
    let colCnpjCliente = -1;
    let colSeq = -1;
    let colCodigo = -1;
    let colDescricao = -1;
    let colHora = -1;
    let colTrib = -1;
    let colSta = -1;
    let colEmbalagem = -1;
    let colLeitura = -1;
    let colQtd = -1;
    let colVlrUnit = -1;
    let colValor = -1;
    let colPrAtual = -1;

    for (let r = 0; r < Math.min(matrix.length, 30); r++) {
      const row = matrix[r];
      if (!Array.isArray(row)) continue;

      let fCod = -1;
      let fQtd = -1;
      let fDt = -1;

      row.forEach((cellVal, cIdx) => {
        const cleaned = cleanHeaderStr(cellVal);
        if (!cleaned) return;

        if (colPdv === -1 && pdvSynonyms.some((s) => cleaned === s || cleaned.includes('PDV'))) colPdv = cIdx;
        if (colCupom === -1 && cupomSynonyms.some((s) => cleaned === s || cleaned.includes('CUPOM'))) colCupom = cIdx;
        if (colOperador === -1 && operadorSynonyms.some((s) => cleaned === s)) colOperador = cIdx;
        if (colDtVenda === -1 && dtVendaSynonyms.some((s) => cleaned === s || cleaned.includes('VENDA') || cleaned === 'DATA')) colDtVenda = cIdx;
        if (colCnpjAtacadao === -1 && cnpjAtacadaoSynonyms.some((s) => cleaned === s)) colCnpjAtacadao = cIdx;
        if (colCnpjCliente === -1 && cnpjClienteSynonyms.some((s) => cleaned === s)) colCnpjCliente = cIdx;
        if (colSeq === -1 && seqSynonyms.some((s) => cleaned === s)) colSeq = cIdx;
        if (colCodigo === -1 && codigoSynonyms.some((s) => cleaned === s || cleaned.includes('CODIGO') || cleaned.includes('CODINT'))) {
          colCodigo = cIdx;
          fCod = cIdx;
        }
        if (colDescricao === -1 && descricaoSynonyms.some((s) => cleaned === s || cleaned.includes('DESCRICAO'))) colDescricao = cIdx;
        if (colHora === -1 && horaSynonyms.some((s) => cleaned === s)) colHora = cIdx;
        if (colTrib === -1 && tribSynonyms.some((s) => cleaned === s)) colTrib = cIdx;
        if (colSta === -1 && staSynonyms.some((s) => cleaned === s)) colSta = cIdx;
        if (colEmbalagem === -1 && embalagemSynonyms.some((s) => cleaned === s || cleaned.includes('EMBALAGEM'))) colEmbalagem = cIdx;
        if (colLeitura === -1 && leituraSynonyms.some((s) => cleaned === s)) colLeitura = cIdx;
        if (colQtd === -1 && qtdSynonyms.some((s) => cleaned === s || cleaned.startsWith('QTD') || cleaned.startsWith('QUANT'))) {
          colQtd = cIdx;
          fQtd = cIdx;
        }
        if (colVlrUnit === -1 && vlrUnitSynonyms.some((s) => cleaned === s)) colVlrUnit = cIdx;
        if (colValor === -1 && valorSynonyms.some((s) => cleaned === s)) colValor = cIdx;
        if (colPrAtual === -1 && prAtualSynonyms.some((s) => cleaned === s)) colPrAtual = cIdx;
      });

      // Need at least CODIGO and QTD (and preferably DT.VENDA) to identify header row
      if (fCod !== -1 && fQtd !== -1) {
        headerRowIndex = r;
        break;
      }
    }

    if (headerRowIndex === -1 || colCodigo === -1 || colQtd === -1) {
      return {
        sucesso: false,
        mensagem:
          'Não foi possível identificar as colunas mínimas (CÓDIGO e QTD.) na planilha de vendas. Verifique se o relatório corresponde ao padrão SASOI061 ou similar.',
        rows: [],
        totalLidos: 0,
      };
    }

    const rawHeadersRow = matrix[headerRowIndex] || [];
    const headerNames: string[] = rawHeadersRow.map((h, i) => String(h || `Coluna_${i + 1}`).trim());

    const rows: RawVendaSASOIRow[] = [];
    for (let r = headerRowIndex + 1; r < matrix.length; r++) {
      const row = matrix[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      const rawCode = colCodigo !== -1 ? row[colCodigo] : '';
      if (rawCode === undefined || rawCode === null || String(rawCode).trim() === '') continue;

      const rawQtd = colQtd !== -1 ? row[colQtd] : 0;
      if (rawQtd === undefined || rawQtd === null || String(rawQtd).trim() === '') continue;

      const pdv = colPdv !== -1 ? String(row[colPdv] || '').trim() : '';
      const cupom = colCupom !== -1 ? String(row[colCupom] || '').trim() : '';
      const operador = colOperador !== -1 ? String(row[colOperador] || '').trim() : '';
      const dtVenda = colDtVenda !== -1 ? row[colDtVenda] : '';
      const cnpjAtacadao = colCnpjAtacadao !== -1 ? String(row[colCnpjAtacadao] || '').trim() : '';
      const cnpjCliente = colCnpjCliente !== -1 ? String(row[colCnpjCliente] || '').trim() : '';
      const seq = colSeq !== -1 ? String(row[colSeq] || '').trim() : String(r);
      const descricaoMercadoria = colDescricao !== -1 ? String(row[colDescricao] || '').trim() : '';
      const horaRaw = colHora !== -1 ? row[colHora] : '';
      const trib = colTrib !== -1 ? String(row[colTrib] || '').trim() : '';
      const sta = colSta !== -1 ? String(row[colSta] || '').trim() : '';
      const embalagemRaw = colEmbalagem !== -1 ? String(row[colEmbalagem] || '').trim() : '';
      const leitura = colLeitura !== -1 ? String(row[colLeitura] || '').trim() : '';

      let vlrUnit = 0;
      if (colVlrUnit !== -1 && row[colVlrUnit] !== undefined) {
        const parsed = parseFloat(String(row[colVlrUnit]).replace(/\./g, '').replace(',', '.'));
        if (!isNaN(parsed)) vlrUnit = parsed;
      }

      let valor = 0;
      if (colValor !== -1 && row[colValor] !== undefined) {
        const parsed = parseFloat(String(row[colValor]).replace(/\./g, '').replace(',', '.'));
        if (!isNaN(parsed)) valor = parsed;
      }

      let prAtual = 0;
      if (colPrAtual !== -1 && row[colPrAtual] !== undefined) {
        const parsed = parseFloat(String(row[colPrAtual]).replace(/\./g, '').replace(',', '.'));
        if (!isNaN(parsed)) prAtual = parsed;
      }

      rows.push({
        pdv,
        cupom,
        operador,
        dtVenda,
        cnpjAtacadao,
        cnpjCliente,
        seq,
        codigoRaw: rawCode,
        descricaoMercadoria,
        horaRaw,
        trib,
        sta,
        embalagemRaw,
        leitura,
        qtdRaw: rawQtd,
        vlrUnit,
        valor,
        prAtual,
      });
    }

    return {
      sucesso: true,
      mensagem: `${rows.length} registros de vendas identificados na planilha.`,
      rows,
      totalLidos: rows.length,
    };
  } catch (err: any) {
    return {
      sucesso: false,
      mensagem: `Erro ao processar relatório de vendas: ${err.message || 'Arquivo inválido.'}`,
      rows: [],
      totalLidos: 0,
    };
  }
}

/**
 * Main processor for Real Sales (SASOI061.xlsx)
 * Implements line-by-line deduplication, DIG validation, packaging normalization,
 * presentation consolidation, FEFO deduction, and divergence registration.
 */
export async function processarImportacaoVendasReais(
  file: File,
  onProgress?: (percent: number, stage: string) => void
): Promise<{
  sucesso: boolean;
  mensagem: string;
  resumo: ResumoImportacaoVendas;
  importacaoId?: number;
}> {
  try {
    onProgress?.(5, 'Lendo arquivo de vendas reais SASOI061...');
    await new Promise((res) => setTimeout(res, 20));

    const parseResult = await parsePlanilhaVendasReaisSASOI061(file);
    if (!parseResult.sucesso || !parseResult.rows.length) {
      return {
        sucesso: false,
        mensagem: parseResult.mensagem || 'Nenhum registro de venda encontrado.',
        resumo: {
          nomeArquivo: file.name,
          dataHoraImportacao: new Date().toLocaleString('pt-BR'),
          totalRegistrosEncontrados: 0,
          novos: 0,
          jaProcessados: 0,
          produtosNaoEncontrados: 0,
          embalagensNaoInterpretadas: 0,
          digsNaoReconhecidos: 0,
          divergencias: 0,
          vendasAplicadasAoControle: 0,
          vendasExcedentes: 0,
        },
      };
    }

    const rawRows = parseResult.rows;
    onProgress?.(15, `Processando ${rawRows.length} linhas de vendas...`);

    // Load current database state
    const [allProdutos, allControles, allVendasExistentes] = await Promise.all([
      db.produtos.toArray(),
      db.controleVencimento.toArray(),
      db.vendasReais.toArray(),
    ]);

    // Build fast lookup maps
    const produtosMap = new Map<string, Produto>(); // Key: codigo (root)
    allProdutos.forEach((p) => produtosMap.set(p.codigo, p));

    const vendasExistentesMap = new Map<string, VendaReal>(); // Key: saleId
    allVendasExistentes.forEach((v) => {
      if (v.saleId) vendasExistentesMap.set(v.saleId, v);
    });

    const nowIso = new Date().toISOString();
    const nowBr = new Date().toLocaleString('pt-BR');

    // Create import record
    const importacaoId = await db.importacoes.add({
      nomeArquivo: `Vendas: ${file.name}`,
      dataHora: nowBr,
      qtdProdutos: 0,
      criadoEm: nowIso,
    });

    let countNovos = 0;
    let countJaProcessados = 0;
    let countProdutosNaoEncontrados = 0;
    let countEmbalagensNaoInterpretadas = 0;
    let countDigsNaoReconhecidos = 0;
    let countDivergencias = 0;
    let countVendasAplicadas = 0;
    let countVendasExcedentes = 0;

    const vendasToSave: VendaReal[] = [];
    const divergenciasToSave: DivergenciaVenda[] = [];

    // Temporary list for valid new sales to be consolidated and processed by FEFO
    interface ValidNewSaleItem {
      rawIndex: number;
      saleId: string;
      codigo: string;
      dig: string;
      codigoOriginal: string;
      descricao: string;
      embalagem: string;
      qtdOriginal: number;
      qtdNormalizada: number;
      unidadeNormalizada: string;
      tipoControle: any;
      dataVenda: string;
      horaVenda: string;
      dataHoraTimestamp: number;
      vlrUnit: number;
      valor: number;
      prAtual: number;
      pdv: string;
      cupom: string;
      seq: string;
      operador: string;
      cnpjAtacadao: string;
      cnpjCliente: string;
      sta: string;
      trib: string;
      leitura: string;
    }

    const validNewSales: ValidNewSaleItem[] = [];

    onProgress?.(30, 'Executando desduplicação por saleId e validação de produtos...');

    // Process line-by-line
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];

      // Parse code and dig
      const { codigo, dig, codigoOriginal } = normalizarCodigoEDig(row.codigoRaw);
      if (!codigo) continue;

      // Parse date and hour
      const dataHora = parseDataHoraVenda(row.dtVenda, row.horaRaw);
      const dataVenda = dataHora.dataVendaStr;
      const horaVenda = dataHora.horaStr;
      const dataHoraTimestamp = dataHora.timestampMs;

      // Generate unique sale ID
      const saleId = gerarSaleId(dataVenda, row.pdv, row.cupom, row.seq, row.cnpjAtacadao);

      // Check if saleId already exists
      if (vendasExistentesMap.has(saleId)) {
        const existingSale = vendasExistentesMap.get(saleId)!;

        // Check if data is identical
        const isIdentical =
          existingSale.codigo === codigo &&
          Math.abs(existingSale.qtdOriginal - Number(row.qtdRaw)) < 0.001;

        if (isIdentical) {
          countJaProcessados++;
          continue; // Safely skip - already processed and discounted
        } else {
          // Conflicting duplicate data
          countDivergencias++;
          const div: DivergenciaVenda = {
            saleId,
            codigo,
            dig,
            codigoOriginal,
            descricao: row.descricaoMercadoria || existingSale.descricao,
            embalagem: row.embalagemRaw,
            qtd: Number(row.qtdRaw) || 0,
            dataVenda,
            horaVenda,
            pdv: row.pdv,
            cupom: row.cupom,
            seq: row.seq,
            status: 'DIVERGENCIA',
            motivo: 'Esta venda já existe no histórico, porém os dados importados são diferentes.',
            importacaoId,
            criadoEm: nowIso,
          };
          divergenciasToSave.push(div);
          continue;
        }
      }

      // It is a NEW sale record
      countNovos++;

      // Check if product exists in catalog
      const prod = produtosMap.get(codigo);
      if (!prod) {
        countProdutosNaoEncontrados++;
        countDivergencias++;
        const div: DivergenciaVenda = {
          saleId,
          codigo,
          dig,
          codigoOriginal,
          descricao: row.descricaoMercadoria,
          embalagem: row.embalagemRaw,
          qtd: Number(row.qtdRaw) || 0,
          dataVenda,
          horaVenda,
          pdv: row.pdv,
          cupom: row.cupom,
          seq: row.seq,
          status: 'PRODUTO_NAO_ENCONTRADO',
          motivo: 'Produto não encontrado no cadastro central.',
          importacaoId,
          criadoEm: nowIso,
        };
        divergenciasToSave.push(div);

        vendasToSave.push({
          saleId,
          codigo,
          dig,
          codigoOriginal,
          descricao: row.descricaoMercadoria,
          embalagem: row.embalagemRaw,
          qtdOriginal: Number(row.qtdRaw) || 0,
          qtdNormalizada: 0,
          unidadeNormalizada: 'indefinido',
          tipoControle: 'NAO_IDENTIFICADO',
          dataVenda,
          horaVenda,
          dataHoraTimestamp,
          pdv: row.pdv,
          cupom: row.cupom,
          seq: row.seq,
          operador: row.operador,
          cnpjAtacadao: row.cnpjAtacadao,
          cnpjCliente: row.cnpjCliente,
          sta: row.sta,
          trib: row.trib,
          leitura: row.leitura,
          vlrUnit: row.vlrUnit,
          valor: row.valor,
          prAtual: row.prAtual,
          status: 'PRODUTO_NAO_ENCONTRADO',
          motivoDivergencia: 'Produto não encontrado no cadastro central.',
          importacaoId,
          criadoEm: nowIso,
        });
        continue;
      }

      // Check DIG compatibility: if product has registered DIG and sale has different DIG
      if (prod.dig && dig && prod.dig !== dig) {
        // If descriptions are completely different or cannot be interpreted
        if (prod.embalagem && row.embalagemRaw && prod.embalagem !== row.embalagemRaw) {
          // Check if both can be normalized
        }
      }

      // Normalize packaging and quantity
      const norm = normalizarQuantidadeVenda(row.qtdRaw, row.embalagemRaw, prod.tipoControle);

      if (!norm.seguro) {
        countEmbalagensNaoInterpretadas++;
        countDivergencias++;
        const div: DivergenciaVenda = {
          saleId,
          codigo,
          dig,
          codigoOriginal,
          descricao: row.descricaoMercadoria || prod.descricao,
          embalagem: row.embalagemRaw,
          qtd: Number(row.qtdRaw) || 0,
          dataVenda,
          horaVenda,
          pdv: row.pdv,
          cupom: row.cupom,
          seq: row.seq,
          status: 'EMBALAGEM_NAO_INTERPRETADA',
          motivo: norm.motivo || 'Embalagem não interpretada com segurança.',
          importacaoId,
          criadoEm: nowIso,
        };
        divergenciasToSave.push(div);

        vendasToSave.push({
          saleId,
          codigo,
          dig,
          codigoOriginal,
          descricao: row.descricaoMercadoria || prod.descricao,
          embalagem: row.embalagemRaw,
          qtdOriginal: norm.qtdOriginal,
          qtdNormalizada: 0,
          unidadeNormalizada: 'indefinido',
          tipoControle: 'NAO_IDENTIFICADO',
          dataVenda,
          horaVenda,
          dataHoraTimestamp,
          pdv: row.pdv,
          cupom: row.cupom,
          seq: row.seq,
          operador: row.operador,
          cnpjAtacadao: row.cnpjAtacadao,
          cnpjCliente: row.cnpjCliente,
          sta: row.sta,
          trib: row.trib,
          leitura: row.leitura,
          vlrUnit: row.vlrUnit,
          valor: row.valor,
          prAtual: row.prAtual,
          status: 'EMBALAGEM_NAO_INTERPRETADA',
          motivoDivergencia: norm.motivo || 'Embalagem não interpretada.',
          importacaoId,
          criadoEm: nowIso,
        });
        continue;
      }

      // Valid new sale!
      validNewSales.push({
        rawIndex: i,
        saleId,
        codigo,
        dig,
        codigoOriginal,
        descricao: row.descricaoMercadoria || prod.descricao,
        embalagem: row.embalagemRaw,
        qtdOriginal: norm.qtdOriginal,
        qtdNormalizada: norm.qtdNormalizada,
        unidadeNormalizada: norm.unidadeNormalizada,
        tipoControle: norm.tipoControle,
        dataVenda,
        horaVenda,
        dataHoraTimestamp,
        vlrUnit: row.vlrUnit,
        valor: row.valor,
        prAtual: row.prAtual,
        pdv: row.pdv,
        cupom: row.cupom,
        seq: row.seq,
        operador: row.operador,
        cnpjAtacadao: row.cnpjAtacadao,
        cnpjCliente: row.cnpjCliente,
        sta: row.sta,
        trib: row.trib,
        leitura: row.leitura,
      });
    }

    onProgress?.(60, 'Consolidando apresentações e aplicando deduções FEFO aos vencimentos...');

    // Group valid new sales by root codigo (Rule 14: Consolidação por produto raiz)
    const salesByCodigo = new Map<string, ValidNewSaleItem[]>();
    validNewSales.forEach((s) => {
      if (!salesByCodigo.has(s.codigo)) {
        salesByCodigo.set(s.codigo, []);
      }
      salesByCodigo.get(s.codigo)!.push(s);
    });

    const auditoriasToSave: AuditoriaFefo[] = [];
    const controlesToUpdate: ControleVencimento[] = [];

    // Map active controls by root codigo
    const controlesByCodigo = new Map<string, ControleVencimento[]>();
    allControles.forEach((c) => {
      if (c.quantidadeAtual > 0) {
        if (!controlesByCodigo.has(c.codigo)) {
          controlesByCodigo.set(c.codigo, []);
        }
        controlesByCodigo.get(c.codigo)!.push(c);
      }
    });

    // Execute FEFO application per product
    for (const [codigo, salesList] of salesByCodigo.entries()) {
      const prod = produtosMap.get(codigo)!;
      const activeControles = (controlesByCodigo.get(codigo) || []).slice();

      // If no active expiration controls exist (Rule 18: Venda de produto sem vencimento cadastrado)
      if (activeControles.length === 0) {
        salesList.forEach((s) => {
          vendasToSave.push({
            saleId: s.saleId,
            codigo: s.codigo,
            dig: s.dig,
            codigoOriginal: s.codigoOriginal,
            descricao: s.descricao,
            embalagem: s.embalagem,
            qtdOriginal: s.qtdOriginal,
            qtdNormalizada: s.qtdNormalizada,
            unidadeNormalizada: s.unidadeNormalizada,
            tipoControle: s.tipoControle,
            dataVenda: s.dataVenda,
            horaVenda: s.horaVenda,
            dataHoraTimestamp: s.dataHoraTimestamp,
            pdv: s.pdv,
            cupom: s.cupom,
            seq: s.seq,
            operador: s.operador,
            cnpjAtacadao: s.cnpjAtacadao,
            cnpjCliente: s.cnpjCliente,
            sta: s.sta,
            trib: s.trib,
            leitura: s.leitura,
            vlrUnit: s.vlrUnit,
            valor: s.valor,
            prAtual: s.prAtual,
            status: 'SEM_VENCIMENTO_ATIVO',
            importacaoId,
            criadoEm: nowIso,
          });
        });
        continue;
      }

      // Sort sales chronologically (Rule 15: Momento da venda)
      salesList.sort((a, b) => a.dataHoraTimestamp - b.dataHoraTimestamp);

      // Sort active controls by dataVencimento ASC (FEFO: Rule 18)
      activeControles.sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));

      const detalhesAuditoriaMap = new Map<number, {
        controleId: number;
        dataVencimento: string;
        qtdAntes: number;
        qtdDescontada: number;
        descontoAplicado: number;
        qtdDepois: number;
      }>();

      let totalProdutoDescontado = 0;
      let totalProdutoExcedente = 0;

      // Process each sale in chronological order
      for (const sale of salesList) {
        let saldoVendaParaDescontar = sale.qtdNormalizada;
        let saleDescontado = 0;
        const controlesAfetadosPelaVenda: number[] = [];

        // Find controls created before or at the moment of this sale
        // Rule 16: Venda que ocorreu antes do cadastro do lote NÃO deve reduzir aquele lote
        const eligibleControles = activeControles.filter((c) => {
          const ctrlCreatedAtMs = new Date(c.criadoEm).getTime();
          return !isNaN(ctrlCreatedAtMs) ? sale.dataHoraTimestamp >= ctrlCreatedAtMs : true;
        });

        if (eligibleControles.length === 0) {
          // No active batches created prior to this sale
          vendasToSave.push({
            saleId: sale.saleId,
            codigo: sale.codigo,
            dig: sale.dig,
            codigoOriginal: sale.codigoOriginal,
            descricao: sale.descricao,
            embalagem: sale.embalagem,
            qtdOriginal: sale.qtdOriginal,
            qtdNormalizada: sale.qtdNormalizada,
            unidadeNormalizada: sale.unidadeNormalizada,
            tipoControle: sale.tipoControle,
            dataVenda: sale.dataVenda,
            horaVenda: sale.horaVenda,
            dataHoraTimestamp: sale.dataHoraTimestamp,
            pdv: sale.pdv,
            cupom: sale.cupom,
            seq: sale.seq,
            operador: sale.operador,
            cnpjAtacadao: sale.cnpjAtacadao,
            cnpjCliente: sale.cnpjCliente,
            sta: sale.sta,
            trib: sale.trib,
            leitura: sale.leitura,
            vlrUnit: sale.vlrUnit,
            valor: sale.valor,
            prAtual: sale.prAtual,
            status: 'SEM_VENCIMENTO_ATIVO',
            qtdAplicadaVencimento: 0,
            qtdExcedente: 0,
            importacaoId,
            criadoEm: nowIso,
          });
          continue;
        }

        // Apply FEFO deduction across eligible controls
        for (const ctrl of eligibleControles) {
          if (saldoVendaParaDescontar <= 0) break;
          if (ctrl.quantidadeAtual <= 0) continue;

          const qtdAntes = ctrl.quantidadeAtual;
          const desconto = Math.min(qtdAntes, saldoVendaParaDescontar);
          const qtdDepois = Math.max(0, qtdAntes - desconto);

          saldoVendaParaDescontar -= desconto;
          saleDescontado += desconto;
          totalProdutoDescontado += desconto;
          controlesAfetadosPelaVenda.push(ctrl.id!);

          // Recalculate EMB1 / EMB9
          let qtdEmb1 = 0;
          let qtdEmb9 = 0;
          if (prod.tipoControle === 'UNIDADE') {
            const emb = converterUnidadesParaEmb1Emb9(qtdDepois, ctrl.unidadesPorCaixa || prod.unidadesPorCaixa || 1);
            qtdEmb1 = emb.emb1;
            qtdEmb9 = emb.emb9;
          } else {
            qtdEmb1 = Math.floor(qtdDepois / 1000);
            qtdEmb9 = qtdDepois % 1000;
          }

          ctrl.quantidadeAtual = qtdDepois;
          ctrl.qtdEmb1 = qtdEmb1;
          ctrl.qtdEmb9 = qtdEmb9;
          ctrl.status = calcularStatusVencimento(ctrl.dataVencimento);
          ctrl.atualizadoEm = nowIso;
          ctrl.ultimaVendaIdentificada = (ctrl.ultimaVendaIdentificada || 0) + desconto;
          ctrl.dataUltimaMovimentacao = nowBr;

          if (!controlesToUpdate.some((c) => c.id === ctrl.id)) {
            controlesToUpdate.push(ctrl);
          }

          // Accumulate batch audit details
          const existingAudit = detalhesAuditoriaMap.get(ctrl.id!);
          if (existingAudit) {
            existingAudit.qtdDescontada += desconto;
            existingAudit.descontoAplicado += desconto;
            existingAudit.qtdDepois = qtdDepois;
          } else {
            detalhesAuditoriaMap.set(ctrl.id!, {
              controleId: ctrl.id!,
              dataVencimento: ctrl.dataVencimento,
              qtdAntes,
              qtdDescontada: desconto,
              descontoAplicado: desconto,
              qtdDepois,
            });
          }

          // Add movement history record
          await db.historicoMovimentacao.add({
            controleVencimentoId: ctrl.id!,
            importacaoId,
            dataHora: nowBr,
            estoqueAnteriorEmb1: String(Math.floor(qtdAntes / (ctrl.unidadesPorCaixa || 1))),
            estoqueAnteriorEmb9: String(qtdAntes % (ctrl.unidadesPorCaixa || 1)),
            estoqueAtualEmb1: String(qtdEmb1),
            estoqueAtualEmb9: String(qtdEmb9),
            venda30DiasAnterior: String(prod.venda30Dias || '0'),
            venda30DiasAtual: String(prod.venda30Dias || '0'),
            vendaIdentificada: desconto,
            movimentacaoIdentificada: desconto,
            quantidadeAnterior: qtdAntes,
            quantidadeNova: qtdDepois,
            alertaDivergencia: false,
          });
        }

        const saleExcedente = Math.max(0, saldoVendaParaDescontar);
        if (saleExcedente > 0) {
          totalProdutoExcedente += saleExcedente;
          countVendasExcedentes++;
          countDivergencias++;

          const motivoExcesso = `A venda (${sale.qtdNormalizada} ${prod.tipoControle === 'PESO' ? 'g' : 'un'}) excedeu o saldo do lote em ${saleExcedente} ${
            prod.tipoControle === 'PESO' ? 'g' : 'un'
          }. O lote foi zerado e o excesso registrado como divergência.`;

          divergenciasToSave.push({
            saleId: sale.saleId,
            codigo: sale.codigo,
            dig: sale.dig,
            codigoOriginal: sale.codigoOriginal,
            descricao: sale.descricao,
            embalagem: sale.embalagem,
            qtd: saleExcedente,
            dataVenda: sale.dataVenda,
            horaVenda: sale.horaVenda,
            pdv: sale.pdv,
            cupom: sale.cupom,
            seq: sale.seq,
            status: 'VENDA_EXCEDENTE',
            motivo: motivoExcesso,
            importacaoId,
            criadoEm: nowIso,
          });
        }

        if (saleDescontado > 0) {
          countVendasAplicadas++;
        }

        vendasToSave.push({
          saleId: sale.saleId,
          codigo: sale.codigo,
          dig: sale.dig,
          codigoOriginal: sale.codigoOriginal,
          descricao: sale.descricao,
          embalagem: sale.embalagem,
          qtdOriginal: sale.qtdOriginal,
          qtdNormalizada: sale.qtdNormalizada,
          unidadeNormalizada: sale.unidadeNormalizada,
          tipoControle: sale.tipoControle,
          dataVenda: sale.dataVenda,
          horaVenda: sale.horaVenda,
          dataHoraTimestamp: sale.dataHoraTimestamp,
          pdv: sale.pdv,
          cupom: sale.cupom,
          seq: sale.seq,
          operador: sale.operador,
          cnpjAtacadao: sale.cnpjAtacadao,
          cnpjCliente: sale.cnpjCliente,
          sta: sale.sta,
          trib: sale.trib,
          leitura: sale.leitura,
          vlrUnit: sale.vlrUnit,
          valor: sale.valor,
          prAtual: sale.prAtual,
          status: saleExcedente > 0 ? 'VENDA_EXCEDENTE' : 'PROCESSADA',
          qtdAplicadaVencimento: saleDescontado,
          qtdExcedente: saleExcedente,
          controlesAfetados: controlesAfetadosPelaVenda,
          motivoDivergencia: saleExcedente > 0 ? `Venda excedeu o saldo do lote em ${saleExcedente}.` : undefined,
          importacaoId,
          criadoEm: nowIso,
        });
      }

      // Register FEFO Audit record for this product
      if (detalhesAuditoriaMap.size > 0 || totalProdutoExcedente > 0) {
        auditoriasToSave.push({
          importacaoId,
          produtoId: prod.id,
          codigo: prod.codigo,
          dig: prod.dig,
          descricao: prod.descricao,
          tipoControle: prod.tipoControle,
          vendaTotalAplicada: totalProdutoDescontado,
          vendaExcedente: totalProdutoExcedente,
          saleIds: salesList.map((s) => s.saleId),
          detalhesVencimentos: Array.from(detalhesAuditoriaMap.values()),
          dataHora: nowBr,
          criadoEm: nowIso,
        });
      }
    }

    onProgress?.(85, 'Gravando auditorias e atualizando banco de dados...');

    // Bulk save in Dexie database
    if (vendasToSave.length > 0) {
      await db.vendasReais.bulkAdd(vendasToSave);
    }
    if (divergenciasToSave.length > 0) {
      await db.divergenciasVendas.bulkAdd(divergenciasToSave);
    }
    if (auditoriasToSave.length > 0) {
      await db.auditoriaFefo.bulkAdd(auditoriasToSave);
    }
    if (controlesToUpdate.length > 0) {
      for (const ctrl of controlesToUpdate) {
        if (ctrl.id) {
          await db.controleVencimento.put(ctrl);
        }
      }
    }

    // Update import record with total lines processed
    await db.importacoes.update(importacaoId, {
      qtdProdutos: vendasToSave.length,
    });

    onProgress?.(100, 'Importação de vendas reais concluída!');
    await new Promise((res) => setTimeout(res, 100));

    const resumo: ResumoImportacaoVendas = {
      nomeArquivo: file.name,
      dataHoraImportacao: nowBr,
      totalRegistrosEncontrados: rawRows.length,
      novos: countNovos,
      jaProcessados: countJaProcessados,
      produtosNaoEncontrados: countProdutosNaoEncontrados,
      embalagensNaoInterpretadas: countEmbalagensNaoInterpretadas,
      digsNaoReconhecidos: countDigsNaoReconhecidos,
      divergencias: countDivergencias,
      vendasAplicadasAoControle: countVendasAplicadas,
      vendasExcedentes: countVendasExcedentes,
    };

    return {
      sucesso: true,
      mensagem: `Relatório de Vendas SASOI061 processado com sucesso! ${countNovos} novos registros processados (${countJaProcessados} já existentes ignorados).`,
      resumo,
      importacaoId,
    };
  } catch (err: any) {
    console.error('Erro no processamento de vendas reais:', err);
    return {
      sucesso: false,
      mensagem: `Erro ao processar relatório de vendas: ${err.message || 'Falha no processamento.'}`,
      resumo: {
        nomeArquivo: file.name,
        dataHoraImportacao: new Date().toLocaleString('pt-BR'),
        totalRegistrosEncontrados: 0,
        novos: 0,
        jaProcessados: 0,
        produtosNaoEncontrados: 0,
        embalagensNaoInterpretadas: 0,
        digsNaoReconhecidos: 0,
        divergencias: 0,
        vendasAplicadasAoControle: 0,
        vendasExcedentes: 0,
      },
    };
  }
}
