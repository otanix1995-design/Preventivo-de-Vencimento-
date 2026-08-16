import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../db/database';
import type { VinculoEAN, Produto } from '../types';
import {
  processarImportacaoVinculosEan,
  baixarModeloPlanilhaVinculoEan,
  exportarVinculosEanExcel,
  normalizarCodigoEDig,
  normalizarEan,
} from '../utils/excel';
import {
  Barcode,
  Upload,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  FileSpreadsheet,
  Trash2,
  Plus,
  Loader2,
  Link2,
  Copy,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Package,
  Layers,
  Database,
  RefreshCw,
} from 'lucide-react';

interface ModalGerenciarEanProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ModalGerenciarEan: React.FC<ModalGerenciarEanProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'importar' | 'lista'>('importar');

  // Import State
  const [eanFile, setEanFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [substituirBaseAntiga, setSubstituirBaseAntiga] = useState(true);
  const [importResult, setImportResult] = useState<{
    sucesso: boolean;
    mensagem: string;
    totalLidos: number;
    totalVinculados: number;
    produtosExistentes: number;
    produtosNovosSemCatalogo: number;
  } | null>(null);

  // Clear confirmation and feedback states
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [clearSuccessMessage, setClearSuccessMessage] = useState<string | null>(null);

  // List State
  const [vinculos, setVinculos] = useState<VinculoEAN[]>([]);
  const [produtosMap, setProdutosMap] = useState<Map<string, Produto>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  // Manual Link Form State
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [manualEan, setManualEan] = useState('');
  const [manualCodigo, setManualCodigo] = useState('');
  const [manualDig, setManualDig] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  // Feedback toast / copied state
  const [copiedEan, setCopiedEan] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadVinculosEProdutos();
      setEanFile(null);
      setImportResult(null);
      setIsProcessing(false);
      setProgress(0);
      setProgressStage('');
      setIsAddingManual(false);
      setShowClearAllConfirm(false);
      setClearSuccessMessage(null);
    }
  }, [isOpen]);

  const loadVinculosEProdutos = async () => {
    const list = await db.vinculosEan.toArray();
    setVinculos(list);

    const prods = await db.produtos.toArray();
    const map = new Map<string, Produto>();
    prods.forEach((p) => {
      map.set(p.id, p);
      map.set(p.codigo, p);
    });
    setProdutosMap(map);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setEanFile(e.target.files[0]);
      setImportResult(null);
    }
  };

  const handleProcessImport = async () => {
    if (!eanFile) return;

    setIsProcessing(true);
    setProgress(0);
    setProgressStage('Iniciando processamento da planilha de vínculos...');
    setImportResult(null);

    const res = await processarImportacaoVinculosEan(
      eanFile,
      (percent, stage) => {
        setProgress(percent);
        if (stage) setProgressStage(stage);
      },
      { limparBaseAntiga: substituirBaseAntiga }
    );

    setIsProcessing(false);
    setImportResult(res);

    if (res.sucesso) {
      await loadVinculosEProdutos();
      onSuccess?.();
    }
  };

  const handleDeleteVinculo = async (id?: number, ean?: string) => {
    if (!id && !ean) return;
    try {
      if (id) {
        await db.vinculosEan.delete(id);
      } else if (ean) {
        await db.vinculosEan.where('ean').equals(ean).delete();
      }
      await loadVinculosEProdutos();
      onSuccess?.();
    } catch (err) {
      console.error('Erro ao remover vínculo EAN:', err);
    }
  };

  const handleClearAllVinculos = async () => {
    try {
      setIsProcessing(true);
      await db.vinculosEan.clear();
      await loadVinculosEProdutos();
      setIsProcessing(false);
      setShowClearAllConfirm(false);
      setClearSuccessMessage('Todos os vínculos de código de barras (EAN) foram apagados com sucesso!');
      setTimeout(() => setClearSuccessMessage(null), 4500);
      onSuccess?.();
    } catch (err) {
      console.error('Erro ao limpar vínculos EAN:', err);
      setIsProcessing(false);
    }
  };

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);

    const cleanE = normalizarEan(manualEan);
    const { codigo: cleanC, dig: cleanD } = normalizarCodigoEDig(manualCodigo, manualDig);

    if (!cleanE) {
      setManualError('Informe um código de barras (EAN) válido.');
      return;
    }
    if (!cleanC) {
      setManualError('Informe o código interno do produto.');
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      const existingProd = await db.produtos.get(cleanC) || await db.produtos.where('codigo').equals(cleanC).first();
      const codOrig = existingProd?.codigoOriginal || (cleanD ? `00000000${cleanC}`.slice(-8) + `-${cleanD}` : cleanC);
      const desc = existingProd?.descricao || `PRODUTO CÓDIGO ${cleanC}${cleanD ? '-' + cleanD : ''}`;

      if (!existingProd) {
        await db.produtos.put({
          id: cleanC,
          codigo: cleanC,
          dig: cleanD,
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
      }

      const existing = await db.vinculosEan.where('ean').equals(cleanE).first();
      if (existing) {
        await db.vinculosEan.update(existing.id!, {
          produtoId: cleanC,
          codigo: cleanC,
          dig: cleanD || existing.dig,
          codigoOriginal: codOrig,
          descricao: desc,
          atualizadoEm: nowIso,
        });
      } else {
        await db.vinculosEan.add({
          ean: cleanE,
          produtoId: cleanC,
          codigo: cleanC,
          dig: cleanD,
          codigoOriginal: codOrig,
          descricao: desc,
          criadoEm: nowIso,
          atualizadoEm: nowIso,
        });
      }

      setManualEan('');
      setManualCodigo('');
      setManualDig('');
      setIsAddingManual(false);
      await loadVinculosEProdutos();
      onSuccess?.();
    } catch (err: any) {
      console.error('Erro ao salvar vínculo manual:', err);
      setManualError('Erro ao gravar vínculo no banco de dados.');
    }
  };

  const handleCopyEan = (ean: string) => {
    navigator.clipboard.writeText(ean);
    setCopiedEan(ean);
    setTimeout(() => setCopiedEan(null), 2000);
  };

  // Filtered vinculados list
  const filteredVinculos = useMemo(() => {
    if (!searchTerm.trim()) return vinculos;

    const term = searchTerm.toLowerCase().trim();
    return vinculos.filter((v) => {
      const matchEan = v.ean.toLowerCase().includes(term);
      const matchCod = v.codigo.toLowerCase().includes(term);
      const matchDig = (v.dig || '').toLowerCase().includes(term);
      const prod = produtosMap.get(v.produtoId) || produtosMap.get(v.codigo);
      const matchProd = prod ? prod.descricao.toLowerCase().includes(term) : false;

      return matchEan || matchCod || matchDig || matchProd;
    });
  }, [vinculos, searchTerm, produtosMap]);

  const totalPages = Math.ceil(filteredVinculos.length / itemsPerPage) || 1;
  const paginatedVinculos = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredVinculos.slice(start, start + itemsPerPage);
  }, [filteredVinculos, currentPage]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl text-slate-900 dark:text-white my-6">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Barcode className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight flex items-center gap-2">
                VÍNCULOS EAN / CÓDIGO DE BARRAS
                <span className="px-2 py-0.5 bg-amber-500 text-slate-950 rounded-full text-xs font-black">
                  {vinculos.length} vinculados
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Vincule códigos de barras (EAN/GTIN) aos códigos internos dos produtos via planilha ou manual
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

        {/* Tab Switcher */}
        <div className="bg-slate-100 dark:bg-slate-950 px-5 pt-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('importar')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-t border-x ${
                activeTab === 'importar'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 border-slate-200 dark:border-slate-800 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importar Planilha EAN (.xlsx / .csv)</span>
            </button>

            <button
              onClick={() => setActiveTab('lista')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-t border-x ${
                activeTab === 'lista'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 border-slate-200 dark:border-slate-800 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Base de Vínculos Cadastrados ({vinculos.length})</span>
            </button>
          </div>

          {vinculos.length > 0 && !showClearAllConfirm && (
            <button
              onClick={() => setShowClearAllConfirm(true)}
              className="mb-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60 flex items-center gap-1 transition-all"
              title="Apagar todos os vínculos de códigos de barras"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Apagar Base Antiga</span>
            </button>
          )}
        </div>

        {/* Global Confirmation Alert for Clear All */}
        {showClearAllConfirm && (
          <div className="mx-5 mt-4 p-4 bg-rose-50 dark:bg-rose-950/80 border-2 border-rose-500/80 rounded-2xl space-y-3 text-rose-950 dark:text-rose-100 shadow-md">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-rose-900 dark:text-rose-100">
                  Deseja apagar TODOS os {vinculos.length} vínculos EAN antigos?
                </h4>
                <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
                  Esta ação limpará completamente o banco de códigos de barras (EAN), permitindo que você importe sua nova planilha do zero.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-200 dark:border-rose-900/60">
              <button
                type="button"
                onClick={() => setShowClearAllConfirm(false)}
                disabled={isProcessing}
                className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearAllVinculos}
                disabled={isProcessing}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>SIM, APAGAR BASE DE VÍNCULOS AGORA</span>
              </button>
            </div>
          </div>
        )}

        {/* Clear Success Toast Notification */}
        {clearSuccessMessage && (
          <div className="mx-5 mt-4 p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-400 rounded-2xl flex items-center gap-2.5 text-emerald-900 dark:text-emerald-200 text-xs font-bold shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>{clearSuccessMessage}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* TAB 1: IMPORTAR PLANILHA */}
          {activeTab === 'importar' && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-input-ean-modal"
                />

                <div className="w-12 h-12 bg-amber-500/20 text-amber-500 rounded-2xl flex items-center justify-center border border-amber-500/30">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>

                <div>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                    Selecione a Nova Planilha de Vínculos EAN
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-md">
                    O arquivo deve conter as colunas de <strong>Código de Barras (EAN/GTIN)</strong> e <strong>Código Interno</strong> do produto.
                  </p>
                </div>

                {eanFile ? (
                  <div className="bg-white dark:bg-slate-900 border border-emerald-400/60 p-3 rounded-2xl w-full max-w-md flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2.5 text-left min-w-0">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {eanFile.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {(eanFile.size / 1024).toFixed(1)} KB • Pronto para processar
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEanFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      title="Remover arquivo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
                  >
                    <Upload className="w-4 h-4" />
                    <span>SELECIONAR PLANILHA (.XLSX / .CSV)</span>
                  </button>
                )}
              </div>

              {/* Import Options Toggle Box */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={substituirBaseAntiga}
                    onChange={(e) => setSubstituirBaseAntiga(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-amber-500 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      Substituir base existente (apagar vínculos antigos antes de importar)
                      {substituirBaseAntiga && (
                        <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] rounded font-extrabold">
                          Recomendado
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      {substituirBaseAntiga
                        ? 'Limpa todos os vínculos anteriores para carregar exclusivamente os novos registros da planilha.'
                        : 'Mantém os vínculos existentes e apenas adiciona ou atualiza os da nova planilha.'}
                    </span>
                  </div>
                </label>
              </div>

              {/* Action Buttons: Process and Download Model */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {eanFile && !isProcessing && (
                  <button
                    onClick={handleProcessImport}
                    className="w-full sm:flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 border border-emerald-400/30"
                  >
                    <Link2 className="w-4 h-4" />
                    <span>
                      {substituirBaseAntiga ? 'SUBSTITUIR BASE E IMPORTAR NOVOS EANs' : 'PROCESSAR E ATUALIZAR EANs'}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={baixarModeloPlanilhaVinculoEan}
                  className="w-full sm:w-auto px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-300 dark:border-slate-700 transition-all shadow-sm active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-amber-500" />
                  <span>Baixar Planilha Modelo EAN (.xlsx)</span>
                </button>
              </div>

              {/* Processing Progress */}
              {isProcessing && (
                <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 shadow-xl space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-2 text-amber-400">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span className="truncate max-w-[320px]">
                        {progressStage || 'Importando vínculos...'}
                      </span>
                    </span>
                    <span className="font-mono text-sm text-amber-400 font-black">
                      {progress}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-200 ease-out"
                      style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Import Result Notification */}
              {importResult && (
                <div
                  className={`p-4 rounded-2xl border text-xs space-y-2 ${
                    importResult.sucesso
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {importResult.sucesso ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                    )}
                    <span>{importResult.mensagem}</span>
                  </div>

                  {importResult.sucesso && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200 dark:border-emerald-900/60 font-mono text-[11px]">
                      <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg">
                        <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Lidos:</span>
                        <strong className="text-slate-900 dark:text-white">{importResult.totalLidos}</strong>
                      </div>
                      <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg">
                        <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Vinculados:</span>
                        <strong className="text-emerald-600 dark:text-emerald-400">{importResult.totalVinculados}</strong>
                      </div>
                      <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg">
                        <span className="text-slate-500 dark:text-slate-400 block text-[10px]">No Catálogo:</span>
                        <strong className="text-teal-600 dark:text-teal-400">{importResult.produtosExistentes}</strong>
                      </div>
                      <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg">
                        <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Novos Códigos:</span>
                        <strong className="text-amber-600 dark:text-amber-400">{importResult.produtosNovosSemCatalogo}</strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Instructions Box */}
              <div className="bg-slate-100 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <h5 className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-slate-100">
                  <Layers className="w-4 h-4 text-amber-500" />
                  Como funciona a importação de Vínculos EAN:
                </h5>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-400 pl-1 leading-relaxed">
                  <li>
                    A planilha pode ter códigos EAN de 8, 12, 13 ou 14 dígitos.
                  </li>
                  <li>
                    O <strong>Código Interno</strong> pode estar no formato simples (ex: <code>70510</code>) ou no formato com zeros e dígito (ex: <code>00070510-150</code>).
                  </li>
                  <li>
                    Ao bipar um código de barras com a câmera, o aplicativo consulta instantaneamente esse banco de dados e abre a ficha do produto automaticamente!
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: LISTA DE VÍNCULOS */}
          {activeTab === 'lista' && (
            <div className="space-y-4">
              
              {/* Actions & Search Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Search */}
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Buscar por EAN, Código ou Descrição..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs font-semibold focus:outline-none focus:border-amber-500"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Quick actions buttons */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                  <button
                    onClick={() => setIsAddingManual(!isAddingManual)}
                    className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Novo Vínculo Manual</span>
                  </button>

                  <button
                    onClick={exportarVinculosEanExcel}
                    disabled={vinculos.length === 0}
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Exportar Excel</span>
                  </button>

                  {vinculos.length > 0 && !showClearAllConfirm && (
                    <button
                      onClick={() => setShowClearAllConfirm(true)}
                      className="px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/60 transition-all text-xs font-bold flex items-center gap-1.5"
                      title="Limpar todos os vínculos"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Limpar Base</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Manual Link Form Drawer */}
              {isAddingManual && (
                <form
                  onSubmit={handleSaveManual}
                  className="bg-amber-50/70 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-300 dark:border-amber-900/60 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-black uppercase text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                      <Link2 className="w-4 h-4 text-amber-600" />
                      Cadastrar Vínculo Manual EAN ↔ Código Interno
                    </h5>
                    <button
                      type="button"
                      onClick={() => setIsAddingManual(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Código de Barras (EAN):
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 7894900011517"
                        value={manualEan}
                        onChange={(e) => setManualEan(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:border-amber-500"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Código Interno do Produto:
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 70510 ou 00070510"
                        value={manualCodigo}
                        onChange={(e) => setManualCodigo(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Dígito (Opcional):
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Ex: 150"
                          value={manualDig}
                          onChange={(e) => setManualDig(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shrink-0 shadow active:scale-95"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  </div>

                  {manualError && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                      {manualError}
                    </p>
                  )}
                </form>
              )}

              {/* Table of EAN Links */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                {paginatedVinculos.length === 0 ? (
                  <div className="py-12 px-4 text-center">
                    <Barcode className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      Nenhum vínculo EAN encontrado.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {searchTerm
                        ? 'Tente ajustar os termos da pesquisa.'
                        : 'Importe uma planilha ou adicione vínculos manuais para começar.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase">
                          <th className="py-2.5 px-3">Código de Barras (EAN)</th>
                          <th className="py-2.5 px-3">Código Interno</th>
                          <th className="py-2.5 px-3">Produto no Catálogo</th>
                          <th className="py-2.5 px-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {paginatedVinculos.map((v) => {
                          const prod = produtosMap.get(v.produtoId) || produtosMap.get(v.codigo);
                          const isCopied = copiedEan === v.ean;

                          return (
                            <tr
                              key={v.id || v.ean}
                              className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              {/* EAN */}
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                                <div className="flex items-center gap-1.5">
                                  <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded font-black tracking-tight text-[11px]">
                                    {v.ean}
                                  </span>
                                  <button
                                    onClick={() => handleCopyEan(v.ean)}
                                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                                    title="Copiar EAN"
                                  >
                                    {isCopied ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>

                              {/* Código Interno */}
                              <td className="py-2.5 px-3 font-mono text-slate-800 dark:text-slate-200">
                                <span className="font-black text-slate-900 dark:text-white">
                                  {v.codigo}
                                </span>
                                {v.dig && (
                                  <span className="text-slate-400 text-[10px] ml-1">
                                    (dig: {v.dig})
                                  </span>
                                )}
                              </td>

                              {/* Produto Vinculado */}
                              <td className="py-2.5 px-3">
                                {prod ? (
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate max-w-xs">
                                      {prod.descricao}
                                    </span>
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                      ● Vinculado ({prod.embalagem}) • {prod.compradorFilial}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full inline-block">
                                    Código salvo (aguardando planilha de estoque)
                                  </span>
                                )}
                              </td>

                              {/* Ações */}
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  onClick={() => handleDeleteVinculo(v.id, v.ean)}
                                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                  title="Remover este vínculo EAN"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination footer */}
                {totalPages > 1 && (
                  <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Mostrando {(currentPage - 1) * itemsPerPage + 1} a{' '}
                      {Math.min(currentPage * itemsPerPage, filteredVinculos.length)} de{' '}
                      {filteredVinculos.length} vínculos
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="font-bold text-slate-700 dark:text-slate-300 px-1.5">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
            Base local Indexada • Total: <strong>{vinculos.length}</strong> códigos EAN
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
