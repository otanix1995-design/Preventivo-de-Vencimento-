import React, { useState, useEffect } from 'react';
import { db } from '../db/database';
import type { Importacao } from '../types';
import { processarImportacaoExcel, baixarPlanilhaExemplo } from '../utils/excel';
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
} from 'lucide-react';

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onGoToCatalogo?: () => void;
}

export const ImportExcelModal: React.FC<ImportExcelModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onGoToCatalogo,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [resultMessage, setResultMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [importacoes, setImportacoes] = useState<Importacao[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setResultMessage(null);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setResultMessage(null);
      setProgress(0);
      setProgressStage('');
    }
  };

  const handleProcessImport = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(0);
    setProgressStage('Iniciando leitura do arquivo...');
    setResultMessage(null);

    const res = await processarImportacaoExcel(selectedFile, (percent, stage) => {
      setProgress(percent);
      if (stage) setProgressStage(stage);
    });

    setIsProcessing(false);

    if (res.sucesso) {
      setResultMessage({
        type: 'success',
        text: `${res.mensagem} ${
          res.produtosMovimentadosCount > 0
            ? `(${res.produtosMovimentadosCount} produtos com movimentação identificada e desconto automático efetuado)`
            : ''
        }`,
      });
      await loadImportacoes();
      onSuccess();
    } else {
      setResultMessage({
        type: 'error',
        text: res.mensagem,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl text-slate-900 dark:text-white my-8">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base">IMPORTAR PLANILHA EXCEL</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* File Dropzone */}
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl p-6 text-center bg-slate-50 dark:bg-slate-950 transition-colors">
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              id="excel-file-input"
              className="hidden"
            />
            <label htmlFor="excel-file-input" className="cursor-pointer space-y-2 block">
              <Upload className="w-10 h-10 text-emerald-500 mx-auto" />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {selectedFile ? selectedFile.name : 'Clique para selecionar a planilha (.xlsx)'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Colunas utilizadas: CÓDIGO, DESCRIÇÃO MERCADORIA, EMBALAGEM, COMPRADOR FILIAL, ESTOQUE EMB1, ESTOQUE EMB9.
                </p>
              </div>
            </label>
          </div>

          {/* Download Sample Spreadsheet */}
          <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/60 p-3 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <FileText className="w-4 h-4 text-emerald-500" />
              <span>Precisa do modelo padrão da planilha?</span>
            </div>
            <button
              onClick={baixarPlanilhaExemplo}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-colors active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Modelo (.xlsx)</span>
            </button>
          </div>

          {/* Action Button & Progress Bar */}
          {selectedFile && !isProcessing && (
            <button
              onClick={handleProcessImport}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow active:scale-95 flex items-center justify-center gap-2"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span>PROCESSAR IMPORTAÇÃO</span>
            </button>
          )}

          {/* Progress Indicator (0 to 100%) */}
          {isProcessing && (
            <div className="bg-slate-900 text-white p-4.5 rounded-2xl border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-2 text-emerald-400">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span className="truncate max-w-[280px]">
                    {progressStage || 'Processando planilha...'}
                  </span>
                </span>
                <span className="font-mono text-base text-emerald-400 font-black">
                  {progress}%
                </span>
              </div>

              {/* Progress Bar Track */}
              <div className="w-full bg-slate-800 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-700">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-300 h-full rounded-full transition-all duration-200 ease-out shadow-sm"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Processando dados</span>
                <span>{progress === 100 ? 'Concluído' : `${progress} de 100%`}</span>
              </div>
            </div>
          )}

          {/* Result Alert */}
          {resultMessage && (
            <div className="space-y-2">
              <div
                className={`p-3.5 rounded-xl text-xs flex items-start gap-2 ${
                  resultMessage.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                }`}
              >
                {resultMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                )}
                <span>{resultMessage.text}</span>
              </div>

              {resultMessage.type === 'success' && onGoToCatalogo && (
                <button
                  onClick={() => {
                    onClose();
                    onGoToCatalogo();
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors border border-slate-700"
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>VER CATÁLOGO DE PRODUTOS IMPORTADOS</span>
                </button>
              )}
            </div>
          )}

          {/* Import History */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
              <History className="w-4 h-4 text-amber-500" />
              Histórico de Importações
            </h4>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {importacoes.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhuma importação realizada ainda.</p>
              ) : (
                importacoes.map((imp, idx) => {
                  const numImport = importacoes.length - idx;
                  const isLatest = idx === 0;

                  return (
                    <div
                      key={imp.id}
                      className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          IMPORTAÇÃO {String(numImport).padStart(2, '0')}{' '}
                          <span className="font-normal text-slate-500">— {imp.dataHora}</span>
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Arquivo: {imp.nomeArquivo} ({imp.qtdProdutos} produtos)
                        </p>
                      </div>

                      {isLatest && (
                        <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
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
    </div>
  );
};
