import React from 'react';
import type { ControleVencimento, Produto } from '../types';
import { formatarDataBR, formatarMoeda, getStatusConfig } from '../utils/date';
import { formatarQuantidade } from '../utils/quantity';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
  PlusCircle,
  FileSpreadsheet,
  Camera,
} from 'lucide-react';

interface DashboardProps {
  controles: ControleVencimento[];
  produtosMap: Map<string, Produto>;
  onNavigateToProdutos: (filterStatus?: string) => void;
  onOpenCadastro: () => void;
  onOpenImport: () => void;
  onOpenScanner: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  controles,
  produtosMap,
  onNavigateToProdutos,
  onOpenCadastro,
  onOpenImport,
  onOpenScanner,
}) => {
  // Metric counts
  const totalControlados = controles.length;
  const vencidos = controles.filter((c) => c.status === 'VENCIDO');
  const venceHoje = controles.filter((c) => c.status === 'VENCE_HOJE');
  const vence3Dias = controles.filter((c) => c.status === 'VENCE_3_DIAS');
  const vence7Dias = controles.filter((c) => c.status === 'VENCE_7_DIAS');
  const mais7Dias = controles.filter((c) => c.status === 'MAIS_7_DIAS');

  // Quantidade total por tipo de controle (gramas para peso, unidades para unidade)
  let totalGramasPeso = 0;
  let totalUnidades = 0;

  controles.forEach((c) => {
    if (c.unidadeControle === 'PESO') {
      totalGramasPeso += c.quantidadeAtual || 0;
    } else if (c.unidadeControle === 'UNIDADE') {
      totalUnidades += c.quantidadeAtual || 0;
    }
  });

  const totalPesoFmt = formatarQuantidade(totalGramasPeso, 'PESO');
  const totalUnidadesFmt = formatarQuantidade(totalUnidades, 'UNIDADE');

  // Filter high priority items (VENCIDO, VENCE HOJE, VENCE 3 DIAS)
  const itensPrioridade = controles
    .filter((c) => c.status === 'VENCIDO' || c.status === 'VENCE_HOJE' || c.status === 'VENCE_3_DIAS')
    .sort((a, b) => {
      const configA = getStatusConfig(a.status);
      const configB = getStatusConfig(b.status);
      return configA.priority - configB.priority || a.dataVencimento.localeCompare(b.dataVencimento);
    });

  return (
    <div className="space-y-6">
      {/* Top Welcome / Quick Action Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-lg border border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <span>Visão Geral do Estoque</span>
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm mt-1">
              Acompanhamento inteligente de validades, movimentações e alerta de produtos críticos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-dash-cadastrar"
              onClick={onOpenCadastro}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs sm:text-sm shadow transition-all active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Novo Vencimento</span>
            </button>
            <button
              id="btn-dash-scanner"
              onClick={onOpenScanner}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs sm:text-sm shadow transition-all active:scale-95"
            >
              <Camera className="w-4 h-4" />
              <span>Escanear EAN</span>
            </button>
            <button
              id="btn-dash-importar"
              onClick={onOpenImport}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium text-xs sm:text-sm border border-slate-600 transition-all active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Importar Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Controlados */}
        <div
          onClick={() => onNavigateToProdutos('TODOS')}
          className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Controlados</span>
            <div className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">{totalControlados}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 font-medium">
            Ver lista <ArrowRight className="w-3 h-3" />
          </p>
        </div>

        {/* Vencidos */}
        <div
          onClick={() => onNavigateToProdutos('VENCIDO')}
          className={`bg-white dark:bg-slate-800/90 rounded-2xl p-4 shadow-sm border ${
            vencidos.length > 0 ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20' : 'border-slate-200 dark:border-slate-700'
          } hover:shadow-md transition-all cursor-pointer group`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-700 dark:text-red-400">🔴 Vencidos</span>
            <div className="p-2 bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 rounded-xl">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-red-700 dark:text-red-400 mt-2">{vencidos.length}</p>
          <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 font-semibold flex items-center gap-1">
            Urgente <ArrowRight className="w-3 h-3" />
          </p>
        </div>

        {/* Vence Hoje */}
        <div
          onClick={() => onNavigateToProdutos('VENCE_HOJE')}
          className={`bg-white dark:bg-slate-800/90 rounded-2xl p-4 shadow-sm border ${
            venceHoje.length > 0 ? 'border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20' : 'border-slate-200 dark:border-slate-700'
          } hover:shadow-md transition-all cursor-pointer group`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300">🟠 Vence Hoje</span>
            <div className="p-2 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-800 dark:text-amber-300 mt-2">{venceHoje.length}</p>
          <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-semibold flex items-center gap-1">
            Ação hoje <ArrowRight className="w-3 h-3" />
          </p>
        </div>

        {/* Vence em até 3 dias */}
        <div
          onClick={() => onNavigateToProdutos('VENCE_3_DIAS')}
          className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-yellow-800 dark:text-yellow-300">🟡 Até 3 Dias</span>
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/60 text-yellow-800 dark:text-yellow-300 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-yellow-800 dark:text-yellow-300 mt-2">{vence3Dias.length}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium flex items-center gap-1">
            Ver itens <ArrowRight className="w-3 h-3" />
          </p>
        </div>

        {/* Vence em até 7 dias */}
        <div
          onClick={() => onNavigateToProdutos('VENCE_7_DIAS')}
          className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">🟡 Até 7 Dias</span>
            <div className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">{vence7Dias.length}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium flex items-center gap-1">
            Ver itens <ArrowRight className="w-3 h-3" />
          </p>
        </div>

        {/* Mais de 7 dias */}
        <div
          onClick={() => onNavigateToProdutos('MAIS_7_DIAS')}
          className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">🟢 &gt; 7 Dias</span>
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-800 dark:text-emerald-300 mt-2">{mais7Dias.length}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium flex items-center gap-1">
            Ver itens <ArrowRight className="w-3 h-3" />
          </p>
        </div>
      </div>

      {/* Total Volume Summary by Control Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-500" />
              Volume Total Próximo ao Vencimento (PESO)
            </span>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {totalPesoFmt}
            </p>
          </div>
          <div className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-3 py-1.5 rounded-xl font-bold text-xs">
            Controle por Kg/Grama
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-500" />
              Volume Total Próximo ao Vencimento (UNIDADES)
            </span>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {totalUnidadesFmt}
            </p>
          </div>
          <div className="bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 px-3 py-1.5 rounded-xl font-bold text-xs">
            Controle por Unidade
          </div>
        </div>
      </div>

      {/* Priority Items Section */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/80 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Produtos em Situação Crítica / Atenção Prioritária
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Produtos que já venceram ou vencem nos próximos 3 dias.
            </p>
          </div>
          <button
            onClick={() => onNavigateToProdutos('TODOS')}
            className="text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 flex items-center gap-1"
          >
            Ver todos <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-700/60 max-h-96 overflow-y-auto">
          {itensPrioridade.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Excelente! Nenhum produto vencido ou vencendo nos próximos 3 dias.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Acompanhe periodicamente suas importações e cadastros de vencimento.
              </p>
            </div>
          ) : (
            itensPrioridade.map((item) => {
              const produto = produtosMap.get(item.produtoId);
              const statusCfg = getStatusConfig(item.status);
              const qtdFmt = formatarQuantidade(item.quantidadeAtual, item.unidadeControle);

              return (
                <div
                  key={item.id}
                  onClick={() => onNavigateToProdutos('TODOS')}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{statusCfg.icon}</span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                          CÓD: {item.codigo} - {item.dig}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${statusCfg.bgClass} ${statusCfg.textClass} ${statusCfg.borderClass}`}
                        >
                          {statusCfg.label}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {produto?.descricao || 'Descrição não disponível'}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
                        <span>Emb: {produto?.embalagem || '-'}</span>
                        <span>•</span>
                        <span>Comprador/Filial: {produto?.compradorFilial || '-'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 text-right border-t sm:border-0 border-slate-100 pt-2 sm:pt-0">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Vencimento</span>
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                        {formatarDataBR(item.dataVencimento)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Qtd Próxima</span>
                      <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                        {qtdFmt}
                      </span>
                    </div>

                    {item.precoTrabalhado && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Preço Trab.</span>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {formatarMoeda(item.precoTrabalhado)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
