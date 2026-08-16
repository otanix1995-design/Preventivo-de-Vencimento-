import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db/database';
import type { Importacao, ResumoImportacaoVendas } from '../types';
import {
  processarDuasPlanilhasExcel,
  parsePlanilhaEstoque,
  baixarModeloPlanilhaEstoque,
  baixarModeloPlanilhaVendas,
  baixarModeloPlanilhaVinculoEan,
} from '../utils/excel';
import { processarImportacaoVendasReais } from '../utils/salesProcessor';
import { ModalDivergenciasVendas } from './ModalDivergenciasVendas';
import {
  FileSpreadsheet,
  Upload,
  Download,
  History,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Clock,
  Loader2,
  Boxes,
  TrendingUp,
  RefreshCw,
  Trash2,
  Layers,
  Barcode,
  Link2,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onGoToCatalogo?: () => void;
  onOpenEanManager?: () => void;
}

export const ImportExcelModal: React.FC<ImportExcelModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onGoToCatalogo,
  onOpenEanManager,
}) => {
  const [estoqueFile, setEstoqueFile] = useState<File | null>(null);
  const [vendasFile, setVendasFile] = useState<File | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [resultMessage, setResultMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [resumoVendas, setResumoVendas] = useState<ResumoImportacaoVendas | null>(null);
  const [isDivergenciasOpen, setIsDivergenciasOpen] = useState(false);

  const [importacoes, setImportacoes] = useState<Importacao[]>([]);

  const estoqueInputRef = useRef<HTMLInputElement>(null);
  const vendasInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setEstoqueFile(null);
      setVendasFile(null);
      setResultMessage(null);
      setResumoVendas(null);
      setIsProcessing(false);
      setProgress(0);
      setProgressStage('');
      return;
    }

    loadImportacoes();
  }, [isOpen]);

  const loadImportacoes = async () => {
    const list = await db.importacoes.orderBy('id').reverse().toArray();
    setImportacoes(list);
  };

  const handleEstoqueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setEstoqueFile(e.target.files[0]);
      setResultMessage(null);
      setResumoVendas(null);
    }
  };

  const handleVendasChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVendasFile(e.target.files[0]);
      setResultMessage(null);
      setResumoVendas(null);
    }
  };

  const handleProcessImport = async () => {
    if (!estoqueFile && !vendasFile) return;

    setIsProcessing(true);
    setProgress(0);
    setProgressStage('Iniciando processamento das planilhas...');
    setResultMessage(null);
    setResumoVendas(null);

    try {
      // 1. Process Stock if present
      if (estoqueFile) {
        setProgress(20);
        setProgressStage('Processando Planilha de Estoque / Produtos...');
        const resEstoque = await processarDuasPlanilhasExcel(estoqueFile, null, (pct, stg) => {
          setProgress(Math.round(pct * 0.45));
          if (stg) setProgressStage(stg);
        });

        if (!resEstoque.sucesso) {
          setIsProcessing(false);
          setResultMessage({ type: 'error', text: resEstoque.mensagem });
          return;
        }
      }

      // 2. Process Sales Report SASOI061 if present
      if (vendasFile) {
        setProgress(50);
        setProgressStage('Processando Relatório de Vendas Reais SASOI061...');
        const resVendas = await processarImportacaoVendasReais(vendasFile, (pct, stg) => {
          const offset = estoqueFile ? 50 : 0;
          const scale = estoqueFile ? 0.5 : 1;
          setProgress(Math.min(100, Math.round(offset + pct * scale)));
          if (stg) setProgressStage(stg);
        });

        setIsProcessing(false);

        if (resVendas.sucesso) {
          setResumoVendas(resVendas.resumo);
          setResultMessage({
            type: 'success',
            text: resVendas.mensagem,
          });
          await loadImportacoes();
          onSuccess();
          return;
        } else {
          setResultMessage({
            type: 'error',
            text: resVendas.mensagem,
          });
          return;
        }
      }

      // If only stock was processed
      setIsProcessing(false);
      setResultMessage({
        type: 'success',
        text: 'Planilha de Estoque processada com sucesso! Cadastros e estoques atualizados.',
      });
      await loadImportacoes();
      onSuccess();
    } catch (err: any) {
      setIsProcessing(false);
      setResultMessage({
        type: 'error',
        text: `Erro durante o processamento: ${err.message || 'Falha inesperada.'}`,
      });
    }
  };

  if (!isOpen) return null;

  const bothFilesLoaded = Boolean(estoqueFile && vendasFile);
  const onlyOneLoaded = Boolean((estoqueFile && !vendasFile) || (!estoqueFile && vendasFile));
  const noFilesLoaded = !estoqueFile && !vendasFile;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl text-slate-900 dark:text-white my-6">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight">IMPORTAÇÃO DE PLANILHAS EXCEL</h3>
              <p className="text-[11px] text-slate-400">
                Sincronização independente: Planilha de Estoque + Planilha de Vendas 30 Dias
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* TWO SEPARATE IMPORT SECTIONS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 1. PLANILHA DE ESTOQUE */}
            <div className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between ${
              estoqueFile
                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 dark:border-emerald-600 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-emerald-400'
            }`}>
              <input
                type="file"
                accept=".xlsx, .xls"
                ref={estoqueInputRef}
                onChange={handleEstoqueChange}
                className="hidden"
                id="file-input-estoque"
              />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-emerald-500" />
                    IMPORTAÇÃO 1: ESTOQUE
                  </span>
                  {estoqueFile && (
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                      CARREGADA
                    </span>
                  )}
                </div>

                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Planilha de Produtos / Estoque
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                  Atualiza cadastro, descrição, embalagem, comprador filial, estoque EMB1 e estoque EMB9.
                </p>

                {estoqueFile ? (
                  <div className="bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 p-2.5 rounded-xl mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {estoqueFile.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {(estoqueFile.size / 1024).toFixed(1)} KB • Pronto
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setEstoqueFile(null);
                          if (estoqueInputRef.current) estoqueInputRef.current.value = '';
                        }}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                        title="Remover arquivo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-100 dark:bg-slate-900/60 p-3 rounded-xl mb-3 text-center border border-dashed border-slate-300 dark:border-slate-700">
                    <p className="text-[11px] text-slate-400 italic">Nenhum arquivo selecionado</p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => estoqueInputRef.current?.click()}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 ${
                  estoqueFile
                    ? 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{estoqueFile ? 'ALTERAR ARQUIVO DE ESTOQUE' : 'SELECIONAR PLANILHA DE ESTOQUE'}</span>
              </button>
            </div>

            {/* 2. PLANILHA DE VENDAS 30 DIAS */}
            <div className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between ${
              vendasFile
                ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 dark:border-indigo-600 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
            }`}>
              <input
                type="file"
                accept=".xlsx, .xls"
                ref={vendasInputRef}
                onChange={handleVendasChange}
                className="hidden"
                id="file-input-vendas"
              />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-indigo-500" />
                    IMPORTAÇÃO 2: VENDAS 30 DIAS
                  </span>
                  {vendasFile && (
                    <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full">
                      CARREGADA
                    </span>
                  )}
                </div>

                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Planilha de Vendas / Venda 30 Dias
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                  Fornece a coluna Quantidade de Venda 30 Dias, trânsito de entrada, última venda e compras.
                </p>

                {vendasFile ? (
                  <div className="bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-800 p-2.5 rounded-xl mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {vendasFile.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {(vendasFile.size / 1024).toFixed(1)} KB • Pronto
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setVendasFile(null);
                          if (vendasInputRef.current) vendasInputRef.current.value = '';
                        }}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                        title="Remover arquivo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-100 dark:bg-slate-900/60 p-3 rounded-xl mb-3 text-center border border-dashed border-slate-300 dark:border-slate-700">
                    <p className="text-[11px] text-slate-400 italic">Nenhum arquivo selecionado</p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => vendasInputRef.current?.click()}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 ${
                  vendasFile
                    ? 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{vendasFile ? 'ALTERAR ARQUIVO DE VENDAS' : 'SELECIONAR PLANILHA DE VENDAS 30 DIAS'}</span>
              </button>
            </div>
          </div>

          {/* STATUS DAS IMPORTAÇÕES */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-400" />
                STATUS DA IMPORTAÇÃO DE DADOS
              </span>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                bothFilesLoaded
                  ? 'bg-emerald-500 text-slate-950'
                  : onlyOneLoaded
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-700 text-slate-300'
              }`}>
                {bothFilesLoaded
                  ? '🟢 PRONTO PARA PROCESSAR'
                  : onlyOneLoaded
                  ? '🟡 AGUARDANDO SEGUNDA PLANILHA'
                  : '⚪ SELECIONE OS ARQUIVOS'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between bg-slate-800/80 px-3 py-2 rounded-xl">
                <span className="text-slate-400">Planilha de Estoque:</span>
                <span className="font-bold flex items-center gap-1 text-slate-200">
                  {estoqueFile ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Carregada
                    </span>
                  ) : (
                    <span className="text-slate-500">⏳ Não selecionada</span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between bg-slate-800/80 px-3 py-2 rounded-xl">
                <span className="text-slate-400">Planilha de Venda 30 Dias:</span>
                <span className="font-bold flex items-center gap-1 text-slate-200">
                  {vendasFile ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Carregada
                    </span>
                  ) : (
                    <span className="text-slate-500">⏳ Não selecionada</span>
                  )}
                </span>
              </div>
            </div>

            {bothFilesLoaded && (
              <p className="text-[11px] text-emerald-400 mt-2.5 bg-emerald-950/50 p-2 rounded-lg border border-emerald-800/50 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>As duas planilhas serão cruzadas pelo <strong>CÓDIGO / DIG</strong> para atualizar estoques e calcular vendas com regra FEFO.</span>
              </p>
            )}

            {onlyOneLoaded && (
              <p className="text-[11px] text-amber-300 mt-2.5 bg-amber-950/40 p-2 rounded-lg border border-amber-800/50 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {estoqueFile
                    ? 'Apenas a planilha de estoque foi selecionada. Os cadastros e estoques serão atualizados sem recálculo automático de vendas.'
                    : 'Apenas a planilha de vendas foi selecionada. O histórico de Venda 30 Dias será atualizado.'}
                </span>
              </p>
            )}
          </div>

          {/* SAMPLES DOWNLOAD SECTION */}
          <div className="bg-slate-100 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              <FileText className="w-4 h-4 text-emerald-500" />
              <span>Modelos padrão de planilhas para download:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={baixarModeloPlanilhaEstoque}
                className="px-2.5 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">Modelo Estoque (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={baixarModeloPlanilhaVendas}
                className="px-2.5 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="truncate">Modelo Vendas 30D (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={baixarModeloPlanilhaVinculoEan}
                className="px-2.5 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">Modelo Vínculo EAN (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* VÍNCULO EAN CALLOUT CARD */}
          {onOpenEanManager && (
            <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-900/60 p-3.5 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-500 rounded-xl">
                  <Barcode className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Planilha de Vínculos EAN / Código de Barras
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Importe códigos de barras vinculados aos códigos internos para busca via scanner.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEanManager();
                }}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-sm shrink-0 transition-all active:scale-95"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Importar Vínculos EAN</span>
              </button>
            </div>
          )}

          {/* MAIN PROCESS BUTTON */}
          {!noFilesLoaded && !isProcessing && (
            <button
              onClick={handleProcessImport}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 border-2 border-emerald-400/30"
            >
              <RefreshCw className="w-5 h-5 animate-pulse" />
              <span>PROCESSAR / ATUALIZAR DADOS</span>
            </button>
          )}

          {/* PROGRESS INDICATOR (0-100%) */}
          {isProcessing && (
            <div className="bg-slate-900 text-white p-4.5 rounded-2xl border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-2 text-emerald-400">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span className="truncate max-w-[320px]">
                    {progressStage || 'Processando planilhas...'}
                  </span>
                </span>
                <span className="font-mono text-base text-emerald-400 font-black">
                  {progress}%
                </span>
              </div>

              {/* Progress Bar Track */}
              <div className="w-full bg-slate-800 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-700">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-400 h-full rounded-full transition-all duration-200 ease-out shadow-sm"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Cruzamento e atualização</span>
                <span>{progress === 100 ? 'Concluído' : `${progress} de 100%`}</span>
              </div>
            </div>
          )}

          {/* SALES IMPORT SUMMARY REPORT */}
          {resumoVendas && (
            <div className="bg-slate-900 text-white p-4.5 rounded-2xl border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4" />
                  RELATÓRIO DE VENDAS IMPORTADO (SASOI061)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {resumoVendas.dataHoraImportacao}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-800/70 p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Registros Encontrados</span>
                  <span className="text-sm font-black text-white font-mono">{resumoVendas.totalRegistrosEncontrados.toLocaleString('pt-BR')}</span>
                </div>

                <div className="bg-slate-800/70 p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Novos</span>
                  <span className="text-sm font-black text-emerald-400 font-mono">{resumoVendas.novos.toLocaleString('pt-BR')}</span>
                </div>

                <div className="bg-slate-800/70 p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Já Processados (Dedupl.)</span>
                  <span className="text-sm font-black text-slate-300 font-mono">{resumoVendas.jaProcessados.toLocaleString('pt-BR')}</span>
                </div>

                <div className="bg-slate-800/70 p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Prod. Não Encontrados</span>
                  <span className="text-sm font-black text-red-400 font-mono">{resumoVendas.produtosNaoEncontrados.toLocaleString('pt-BR')}</span>
                </div>

                <div className="bg-slate-800/70 p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Emb. Não Interpretadas</span>
                  <span className="text-sm font-black text-orange-400 font-mono">{resumoVendas.embalagensNaoInterpretadas.toLocaleString('pt-BR')}</span>
                </div>

                <div className="bg-slate-800/70 p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Divergências Totais</span>
                  <span className="text-sm font-black text-amber-400 font-mono">{resumoVendas.divergencias.toLocaleString('pt-BR')}</span>
                </div>
              </div>

              <div className="bg-emerald-950/40 border border-emerald-800/60 p-3 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-emerald-300 block uppercase font-bold">Vendas Aplicadas ao Controle (FEFO)</span>
                  <span className="text-sm font-black text-emerald-400 font-mono">{resumoVendas.vendasAplicadasAoControle.toLocaleString('pt-BR')} registros</span>
                </div>
                {resumoVendas.vendasExcedentes > 0 && (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2 py-1 rounded-lg">
                    ⚠️ {resumoVendas.vendasExcedentes} com venda excedente
                  </span>
                )}
              </div>

              {resumoVendas.divergencias > 0 && (
                <button
                  type="button"
                  onClick={() => setIsDivergenciasOpen(true)}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm active:scale-95"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>VER DETALHES DAS DIVERGÊNCIAS ({resumoVendas.divergencias})</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* RESULT ALERT */}
          {resultMessage && (
            <div className="space-y-2">
              <div
                className={`p-4 rounded-2xl text-xs flex items-start gap-2.5 ${
                  resultMessage.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                }`}
              >
                {resultMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed">{resultMessage.text}</span>
              </div>

              {resultMessage.type === 'success' && onGoToCatalogo && (
                <button
                  onClick={() => {
                    onClose();
                    onGoToCatalogo();
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors border border-slate-700 shadow-sm"
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>VER CATÁLOGO DE PRODUTOS ATUALIZADO</span>
                </button>
              )}
            </div>
          )}

          {/* IMPORT HISTORY */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
              <History className="w-4 h-4 text-amber-500" />
              Histórico de Processamento
            </h4>

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {importacoes.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhum processamento realizado ainda.</p>
              ) : (
                importacoes.map((imp, idx) => {
                  const numImport = importacoes.length - idx;
                  const isLatest = idx === 0;

                  return (
                    <div
                      key={imp.id}
                      className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          IMPORTAÇÃO {String(numImport).padStart(2, '0')}{' '}
                          <span className="font-normal text-slate-500">— {imp.dataHora}</span>
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {imp.nomeArquivo} ({imp.qtdProdutos} produtos)
                        </p>
                      </div>

                      {isLatest && (
                        <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800 shrink-0">
                          ATUAL
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-300 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>

      <ModalDivergenciasVendas
        isOpen={isDivergenciasOpen}
        onClose={() => setIsDivergenciasOpen(false)}
      />
    </div>
  );
};
