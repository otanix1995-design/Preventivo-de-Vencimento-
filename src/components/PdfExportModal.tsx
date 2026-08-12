import React, { useState } from 'react';
import type { ControleVencimento, Produto, FiltroPdfOptions } from '../types';
import { gerarRelatorioPdf, type ItemRelatorioPdf } from '../utils/pdf';
import { getStatusConfig } from '../utils/date';
import { Printer, Filter, ArrowUpDown, X, FileCheck } from 'lucide-react';

interface PdfExportModalProps {
  isOpen: boolean;
  controles: ControleVencimento[];
  produtosMap: Map<string, Produto>;
  onClose: () => void;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  controles,
  produtosMap,
  onClose,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  const [filterComprador, setFilterComprador] = useState<string>('TODOS');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [ordenacao, setOrdenacao] = useState<
    'DATA_VENCIMENTO' | 'CODIGO' | 'DESCRICAO' | 'COMPRADOR' | 'PRIORIDADE'
  >('DATA_VENCIMENTO');

  if (!isOpen) return null;

  // Extract available Comprador Filial list
  const compradoresFiliais = Array.from(
    new Set(Array.from(produtosMap.values()).map((p: Produto) => p.compradorFilial).filter(Boolean))
  );

  const handleGeneratePdf = () => {
    // Apply filters
    const filteredItems: ItemRelatorioPdf[] = [];

    for (const c of controles) {
      const p = produtosMap.get(c.produtoId);
      if (!p) continue;

      // Status filter
      if (filterStatus === 'PERIODO') {
        if (dataInicio && c.dataVencimento < dataInicio) continue;
        if (dataFim && c.dataVencimento > dataFim) continue;
      } else if (filterStatus !== 'TODOS' && c.status !== filterStatus) {
        continue;
      }

      // Comprador Filial filter
      if (filterComprador !== 'TODOS' && p.compradorFilial !== filterComprador) {
        continue;
      }

      filteredItems.push({ controle: c, produto: p });
    }

    // Sort items
    filteredItems.sort((a, b) => {
      if (ordenacao === 'DATA_VENCIMENTO') {
        return a.controle.dataVencimento.localeCompare(b.controle.dataVencimento);
      } else if (ordenacao === 'CODIGO') {
        return parseInt(a.controle.codigo, 10) - parseInt(b.controle.codigo, 10);
      } else if (ordenacao === 'DESCRICAO') {
        return (a.produto.descricao || '').localeCompare(b.produto.descricao || '');
      } else if (ordenacao === 'COMPRADOR') {
        return (a.produto.compradorFilial || '').localeCompare(b.produto.compradorFilial || '');
      } else if (ordenacao === 'PRIORIDADE') {
        const cfgA = getStatusConfig(a.controle.status);
        const cfgB = getStatusConfig(b.controle.status);
        return cfgA.priority - cfgB.priority;
      }
      return 0;
    });

    const filtroOptions: FiltroPdfOptions = {
      status: filterStatus as any,
      dataInicio,
      dataFim,
      compradorFilial: filterComprador,
      ordenacao,
    };

    gerarRelatorioPdf(filteredItems, filtroOptions);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-900 dark:text-white">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-base">GERAR RELATÓRIO EM PDF</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Selecione as opções de filtro e ordenação desejadas para a emissão do relatório em PDF.
          </p>

          {/* Status Filter */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              FILTRAR POR STATUS DE VENCIMENTO
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-amber-500"
            >
              <option value="TODOS">Todos os Produtos</option>
              <option value="VENCIDO">🔴 Apenas Vencidos</option>
              <option value="VENCE_HOJE">🟠 Vence Hoje</option>
              <option value="VENCE_3_DIAS">🟡 Vence em até 3 Dias</option>
              <option value="VENCE_7_DIAS">🟡 Vence em até 7 Dias</option>
              <option value="PERIODO">📅 Período Personalizado</option>
            </select>
          </div>

          {/* Custom Date Range */}
          {filterStatus === 'PERIODO' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block mb-1">Data Início</span>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block mb-1">Data Fim</span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>
          )}

          {/* Comprador Filial Filter */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              FILTRAR POR COMPRADOR FILIAL
            </label>
            <select
              value={filterComprador}
              onChange={(e) => setFilterComprador(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-amber-500"
            >
              <option value="TODOS">Todos os Compradores e Filiais</option>
              {compradoresFiliais.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Order By */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              ORDENAÇÃO DO RELATÓRIO
            </label>
            <select
              value={ordenacao}
              onChange={(e: any) => setOrdenacao(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-amber-500"
            >
              <option value="DATA_VENCIMENTO">Data de Vencimento</option>
              <option value="PRIORIDADE">Prioridade de Vencimento</option>
              <option value="CODIGO">Código do Produto</option>
              <option value="DESCRICAO">Descrição do Produto</option>
              <option value="COMPRADOR">Comprador Filial</option>
            </select>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              onClick={handleGeneratePdf}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-xl text-sm transition-colors shadow active:scale-95 flex items-center justify-center gap-2"
            >
              <Printer className="w-5 h-5" />
              <span>GERAR E BAIXAR PDF</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-300 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
