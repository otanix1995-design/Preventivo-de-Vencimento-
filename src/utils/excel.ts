import * as XLSX from 'xlsx';
import { db } from '../db/database';
import type { Produto, TipoControle } from '../types';
import { identificarTipoEmbalagem } from './packaging';
import { parseEstoqueExcelToNumeric, formatarQuantidade } from './quantity';
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
 */
export function normalizarCodigoEDig(rawCode: any): CodeDigResult {
  const str = String(rawCode || '').trim();
  if (!str) {
    return { codigo: '', dig: '', codigoOriginal: '' };
  }

  const codigoOriginal = str;

  if (str.includes('-')) {
    const parts = str.split('-');
    const partBefore = parts[0].trim();
    const partAfter = parts.slice(1).join('-').trim();

    // Remove leading zeros from code
    const codigoClean = partBefore.replace(/^0+/, '') || '0';
    // DIG is the 3 digits after hyphen
    const digClean = partAfter;

    return {
      codigo: codigoClean,
      dig: digClean,
      codigoOriginal,
    };
  } else {
    const codigoClean = str.replace(/^0+/, '') || '0';
    return {
      codigo: codigoClean,
      dig: '',
      codigoOriginal,
    };
  }
}

/**
 * Normalizes header string for broad fuzzy matching
 */
function cleanHeaderStr(str: any): string {
  return String(str || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^A-Z0-9]/g, '');      // keep alphanumeric
}

/**
 * Process Excel file import with progress tracking callback (0-100%)
 */
export async function processarImportacaoExcel(
  file: File,
  onProgress?: (percent: number, stageText?: string) => void
): Promise<{
  sucesso: boolean;
  mensagem: string;
  importacaoId?: number;
  totalProdutosImportados: number;
  produtosMovimentadosCount: number;
}> {
  return new Promise((resolve) => {
    onProgress?.(5, 'Iniciando leitura do arquivo Excel...');
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        onProgress?.(15, 'Analisando estrutura das planilhas...');
        await new Promise((res) => setTimeout(res, 10));

        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        if (!workbook.SheetNames.length) {
          onProgress?.(100, 'Erro: Arquivo vazio.');
          return resolve({
            sucesso: false,
            mensagem: 'O arquivo Excel está vazio ou inválido.',
            totalProdutosImportados: 0,
            produtosMovimentadosCount: 0,
          });
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        onProgress?.(25, 'Buscando cabeçalhos e mapeando colunas...');
        await new Promise((res) => setTimeout(res, 10));

        // Parse sheet as raw matrix (array of arrays) to locate header row reliably
        const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          blankrows: false,
        });

        if (!matrix.length) {
          onProgress?.(100, 'Erro: Nenhuma linha encontrada.');
          return resolve({
            sucesso: false,
            mensagem: 'Nenhuma linha de dados encontrada na planilha.',
            totalProdutosImportados: 0,
            produtosMovimentadosCount: 0,
          });
        }

        // Synonyms lists (cleaned strings)
        const codigoSynonyms = ['CODIGO', 'COD', 'CODIGOMERCADORIA', 'SKU', 'ITEM', 'PLU', 'CODPROD', 'CODIGOITEM', 'MERCADORIACOD'];
        const descricaoSynonyms = ['DESCRICAOMERCADORIA', 'DESCRICAO', 'MERCADORIA', 'PRODUTO', 'DESCRICAOPRODUTO', 'NOME', 'DESCR', 'DISCRIMINACAO'];
        const embalagemSynonyms = ['EMBALAGEM', 'EMB', 'EMBAL', 'EMBALAGENS', 'UNIDADE', 'UNIDADEMEDIDA'];
        const compradorSynonyms = ['COMPRADORFILIAL', 'COMPRADOR', 'FILIAL', 'COMPRADORFIL', 'NOMECOMPRADOR'];
        const emb1Synonyms = ['ESTOQUEEMB1', 'ESTOQUE1', 'EMB1', 'ESTEMB1', 'SALDOEMB1', 'ESTOQUEEMB01'];
        const emb9Synonyms = ['ESTOQUEEMB9', 'ESTOQUE9', 'EMB9', 'ESTEMB9', 'SALDOEMB9', 'ESTOQUEEMB09'];

        // Find header row (scan first 30 rows)
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

          let foundCod = -1;
          let foundDesc = -1;
          let foundEmbal = -1;
          let foundComp = -1;
          let foundE1 = -1;
          let foundE9 = -1;

          row.forEach((cellVal, cIdx) => {
            const cleaned = cleanHeaderStr(cellVal);
            if (!cleaned) return;

            if (foundCod === -1 && codigoSynonyms.some((syn) => cleaned === syn || cleaned.includes('CODIGO') || cleaned.includes('SKU'))) {
              foundCod = cIdx;
            }
            if (foundDesc === -1 && descricaoSynonyms.some((syn) => cleaned === syn || cleaned.includes('DESCRICAO') || cleaned.includes('MERCADORIA'))) {
              foundDesc = cIdx;
            }
            if (foundEmbal === -1 && embalagemSynonyms.some((syn) => cleaned === syn || cleaned.includes('EMBALAGEM'))) {
              foundEmbal = cIdx;
            }
            if (foundComp === -1 && compradorSynonyms.some((syn) => cleaned === syn || cleaned.includes('COMPRADOR'))) {
              foundComp = cIdx;
            }
            if (foundE1 === -1 && emb1Synonyms.some((syn) => cleaned === syn || cleaned.includes('EMB1') || cleaned.includes('ESTOQUE1'))) {
              foundE1 = cIdx;
            }
            if (foundE9 === -1 && emb9Synonyms.some((syn) => cleaned === syn || cleaned.includes('EMB9') || cleaned.includes('ESTOQUE9'))) {
              foundE9 = cIdx;
            }
          });

          // A valid header row MUST at least have a code or description match
          if (foundCod !== -1 || foundDesc !== -1) {
            headerRowIndex = r;
            colIndexCodigo = foundCod;
            colIndexDescricao = foundDesc;
            colIndexEmbalagem = foundEmbal;
            colIndexComprador = foundComp;
            colIndexEmb1 = foundE1;
            colIndexEmb9 = foundE9;
            break;
          }
        }

        if (headerRowIndex === -1 || (colIndexCodigo === -1 && colIndexDescricao === -1)) {
          onProgress?.(100, 'Cabeçalhos não identificados.');
          return resolve({
            sucesso: false,
            mensagem:
              'Não foi possível identificar o cabeçalho das colunas principais (CÓDIGO e DESCRIÇÃO MERCADORIA) na planilha. Verifique se o arquivo possui títulos de colunas.',
            totalProdutosImportados: 0,
            produtosMovimentadosCount: 0,
          });
        }

        const rawHeadersRow = matrix[headerRowIndex] || [];
        const headerNames: string[] = rawHeadersRow.map((h, i) => String(h || `Coluna_${i + 1}`).trim());

        // Find immediately previous import for stock movement calculation
        const ultimaImportacao = await db.importacoes.orderBy('id').last();

        const timestampStr = getFormattedTimestamp();
        const nowIso = new Date().toISOString();

        // Create new import record
        const importacaoId = await db.importacoes.add({
          nomeArquivo: file.name,
          dataHora: timestampStr,
          criadoEm: nowIso,
          qtdProdutos: 0,
        });

        const totalRows = matrix.length - (headerRowIndex + 1);
        onProgress?.(30, `Iniciando leitura de ${totalRows} linhas de produtos...`);
        await new Promise((res) => setTimeout(res, 10));

        // Get existing products in memory for tipoControle / criadoEm lookup
        const existingProductsList = await db.produtos.toArray();
        const existingProductsMap = new Map<string, Produto>(
          existingProductsList.map((p) => [p.id, p])
        );

        const produtosBatch: Produto[] = [];
        const estoqueHistoricoBatch: any[] = [];
        let totalProdutosImportados = 0;

        // Process rows below header row
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

          // Extract ALL extra columns for future reference
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

          const tipoControle = identificarTipoEmbalagem(embalagem);
          const produtoId = codigo;

          const existingProd = existingProductsMap.get(produtoId);

          const produtoObj: Produto = {
            id: produtoId,
            codigo,
            dig,
            codigoOriginal,
            descricao,
            embalagem,
            tipoControle:
              existingProd?.tipoControle && existingProd.tipoControle !== 'NAO_IDENTIFICADO'
                ? existingProd.tipoControle
                : tipoControle,
            compradorFilial,
            estoqueEmb1,
            estoqueEmb9,
            outrasColunas: Object.keys(outrasColunas).length > 0 ? outrasColunas : undefined,
            criadoEm: existingProd?.criadoEm || nowIso,
            atualizadoEm: nowIso,
          };

          produtosBatch.push(produtoObj);
          totalProdutosImportados++;

          // Record stock history item
          estoqueHistoricoBatch.push({
            importacaoId,
            produtoId,
            codigo,
            dig,
            estoqueEmb1,
            estoqueEmb9,
            dataHora: timestampStr,
          });

          // Report progress periodically (every 25 rows or last row)
          const processedCount = r - headerRowIndex;
          if (processedCount % 25 === 0 || r === matrix.length - 1) {
            const currentPct = Math.min(
              80,
              Math.round(30 + (processedCount / Math.max(totalRows, 1)) * 50)
            );
            onProgress?.(currentPct, `Lendo produto ${processedCount} de ${totalRows}...`);
            await new Promise((res) => setTimeout(res, 0)); // yield thread to UI
          }
        }

        // Save products batch to IndexedDB
        onProgress?.(82, `Salvando ${produtosBatch.length} produtos no catálogo local...`);
        await db.produtos.bulkPut(produtosBatch);

        // Save stock history batch
        onProgress?.(88, 'Registrando histórico de estoques da importação...');
        await db.estoqueHistorico.bulkAdd(estoqueHistoricoBatch);

        // Stock Comparison & Auto-discounting logic
        let produtosMovimentadosCount = 0;
        if (ultimaImportacao && ultimaImportacao.id) {
          onProgress?.(92, 'Comparando estoques com a importação anterior...');
          
          // Map previous stock items by product ID
          const prevStockList = await db.estoqueHistorico
            .where('importacaoId')
            .equals(ultimaImportacao.id)
            .toArray();
          const prevStockMap = new Map(prevStockList.map((s) => [s.produtoId, s]));

          for (let i = 0; i < produtosBatch.length; i++) {
            const produtoObj = produtosBatch[i];
            const prevStockHist = prevStockMap.get(produtoObj.id);

            if (prevStockHist) {
              const numPrevEmb1 = parseEstoqueExcelToNumeric(prevStockHist.estoqueEmb1, produtoObj.tipoControle);
              const numPrevEmb9 = parseEstoqueExcelToNumeric(prevStockHist.estoqueEmb9, produtoObj.tipoControle);
              const numCurrEmb1 = parseEstoqueExcelToNumeric(produtoObj.estoqueEmb1, produtoObj.tipoControle);
              const numCurrEmb9 = parseEstoqueExcelToNumeric(produtoObj.estoqueEmb9, produtoObj.tipoControle);

              const totalStockPrev = numPrevEmb1 + numPrevEmb9;
              const totalStockCurr = numCurrEmb1 + numCurrEmb9;

              const movimentacao = totalStockPrev - totalStockCurr;

              if (movimentacao > 0) {
                // Stock decreased -> subtract movement from expiration controls
                const controlesAtivos = await db.controleVencimento
                  .where({ produtoId: produtoObj.id })
                  .filter((c) => c.quantidadeAtual > 0)
                  .sortBy('dataVencimento');

                if (controlesAtivos.length > 0) {
                  produtosMovimentadosCount++;
                  let decontoRestante = movimentacao;

                  for (const ctrl of controlesAtivos) {
                    if (decontoRestante <= 0) break;

                    const qtdAnterior = ctrl.quantidadeAtual;
                    const valorDesconto = Math.min(qtdAnterior, decontoRestante);
                    const qtdNova = qtdAnterior - valorDesconto;
                    
                    // Check if movement exceeded controlled quantity
                    const excesso = decontoRestante - valorDesconto;
                    decontoRestante -= valorDesconto;

                    const teveAlerta = excesso > 0 || movimentacao > qtdAnterior;
                    const novoStatus = calcularStatusVencimento(ctrl.dataVencimento);

                    await db.controleVencimento.update(ctrl.id!, {
                      quantidadeAtual: qtdNova,
                      status: novoStatus,
                      alertaMovimentacaoSuperior: teveAlerta,
                      movimentacaoExcedente: excesso > 0 ? excesso : 0,
                      atualizadoEm: nowIso,
                    });

                    await db.historicoMovimentacao.add({
                      controleVencimentoId: ctrl.id!,
                      importacaoId,
                      dataHora: timestampStr,
                      estoqueAnteriorEmb1: prevStockHist.estoqueEmb1,
                      estoqueAnteriorEmb9: prevStockHist.estoqueEmb9,
                      estoqueAtualEmb1: produtoObj.estoqueEmb1,
                      estoqueAtualEmb9: produtoObj.estoqueEmb9,
                      movimentacaoIdentificada: movimentacao,
                      quantidadeAnterior: qtdAnterior,
                      quantidadeNova: qtdNova,
                      alertaMovimentacaoSuperior: teveAlerta,
                      movimentacaoExcedente: excesso > 0 ? excesso : 0,
                    });
                  }
                }
              } else if (movimentacao < 0) {
                // Stock increased -> log variation in history without altering controlled expiration quantity
                const controlesDoProduto = await db.controleVencimento
                  .where({ produtoId: produtoObj.id })
                  .toArray();

                if (controlesDoProduto.length > 0) {
                  const firstCtrl = controlesDoProduto[0];
                  await db.historicoMovimentacao.add({
                    controleVencimentoId: firstCtrl.id!,
                    importacaoId,
                    dataHora: timestampStr,
                    estoqueAnteriorEmb1: prevStockHist.estoqueEmb1,
                    estoqueAnteriorEmb9: prevStockHist.estoqueEmb9,
                    estoqueAtualEmb1: produtoObj.estoqueEmb1,
                    estoqueAtualEmb9: produtoObj.estoqueEmb9,
                    movimentacaoIdentificada: movimentacao,
                    quantidadeAnterior: firstCtrl.quantidadeAtual,
                    quantidadeNova: firstCtrl.quantidadeAtual, // Unchanged!
                    alertaMovimentacaoSuperior: false,
                    movimentacaoExcedente: 0,
                  });
                }
              }
            }

            if (i % 50 === 0) {
              await new Promise((res) => setTimeout(res, 0));
            }
          }
        }

        // Update import count
        await db.importacoes.update(importacaoId, {
          qtdProdutos: totalProdutosImportados,
        });

        onProgress?.(100, 'Importação e comparação concluídas!');
        await new Promise((res) => setTimeout(res, 200));

        return resolve({
          sucesso: true,
          mensagem: `Importação concluída com sucesso! ${totalProdutosImportados} produtos lidos e salvos no catálogo.`,
          importacaoId,
          totalProdutosImportados,
          produtosMovimentadosCount,
        });
      } catch (err: any) {
        console.error('Erro na importação Excel:', err);
        onProgress?.(100, 'Erro durante o processamento.');
        return resolve({
          sucesso: false,
          mensagem: `Erro ao processar planilha: ${err.message || 'Formato de arquivo incompatível.'}`,
          totalProdutosImportados: 0,
          produtosMovimentadosCount: 0,
        });
      }
    };

    reader.onerror = () => {
      onProgress?.(100, 'Erro ao ler arquivo.');
      resolve({
        sucesso: false,
        mensagem: 'Falha ao ler o arquivo selecionado.',
        totalProdutosImportados: 0,
        produtosMovimentadosCount: 0,
      });
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Creates and downloads a sample template Excel spreadsheet (.xlsx) for users
 */
export function baixarPlanilhaExemplo() {
  const exampleData = [
    {
      'CÓDIGO': '00070510-150',
      'DESCRIÇÃO MERCADORIA': 'MORTADELA AURORA TRADICIONAL 1KG',
      'EMBALAGEM': 'KG 1 X 1000 X 1G',
      'COMPRADOR FILIAL': 'JOAO SILVA - MATRIZ',
      'ESTOQUE EMB1': '150,500',
      'ESTOQUE EMB9': '0,500',
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
      'FORNECEDOR': 'LATICINIOS ITAMBE',
      'CATEGORIA': 'LATICINIOS',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(exampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Estoque');

  // Auto column width
  const colWidths = [
    { wch: 15 }, // CÓDIGO
    { wch: 45 }, // DESCRIÇÃO
    { wch: 22 }, // EMBALAGEM
    { wch: 28 }, // COMPRADOR FILIAL
    { wch: 15 }, // ESTOQUE EMB1
    { wch: 15 }, // ESTOQUE EMB9
    { wch: 25 }, // FORNECEDOR
    { wch: 20 }, // CATEGORIA
  ];
  ws['!cols'] = colWidths;

  XLSX.writeFile(wb, 'Exemplo_Estoque_Vencimentos.xlsx');
}

