import React, { useEffect, useState } from 'react';
import { db } from '../db/database';
import type { ControleVencimento, Produto, HistoricoMovimentacao } from '../types';
import { formatarDataBR, formatarMoeda } from '../utils/date';
import { formatarQuantidade, formatarVendaIdentificada } from '../utils/quantity';
import { History, X, Clock, TrendingDown, ArrowRight, FileSpreadsheet, AlertTriangle } from 'lucide-react';

interface DetachedHistoryModalProps {
  isOpen: boolean;
  controle: ControleVencimento | null;
  produto: Produto | null;
  onClose: () => void;
}

export const DetachedHistoryModal: React.FC<DetachedHistoryModalProps> = ({
  isOpen,
  controle,
  produto,
  onClose,
}) => {
  const [movimentacoes, setMovimentacoes] = useState<HistoricoMovimentacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !controle || !controle.id) return;

    const loadMovimentacoes = async () => {
      setLoading(true);
      const list = await db.historicoMovimentacao
        .where({ controleVencimentoId: controle.id })
        .reverse()
        .toArray();

      setMovimentacoes(list);
      setLoading(false);
    };

    loadMovimentacoes();
  }, [isOpen, controle]);

  if (!isOpen || !controle) return null;

  const qtdAtualFmt = formatarQuantidade(
    controle.quantidadeAtual,
    controle.unidadeControle,
    false,
    controle.unidadesPorCaixa
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl text-slate-900 dark:text-white my-8">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base">Histórico de Movimentações e Vendas</h3>
              <p className="text-xs text-slate-400 font-mono">
                CÓD: {controle.codigo} - {controle.dig}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Summary Card */}
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {produto?.descricao || 'Produto'}
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Venda 30 Dias (Excel)</span>
                <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                  {produto?.venda30Dias || controle.venda30DiasStr || '—'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Qtd Próx. Vencimento</span>
                <span className="font-black text-amber-600 dark:text-amber-400">{qtdAtualFmt}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Data Vencimento</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{formatarDataBR(controle.dataVencimento)}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Estoque (EMB1 / EMB9)</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {produto?.estoqueEmb1 || 0} / {produto?.estoqueEmb9 || 0}
                </span>
              </div>
            </div>

            {controle.alertaDivergencia && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 rounded-xl text-xs font-bold text-amber-800 dark:text-amber-200 space-y-1">
                <p className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>⚠️ {controle.motivoDivergencia ? 'SITUAÇÃO DE ATENÇÃO' : 'VARIAÇÃO NA VENDA 30 DIAS'}</span>
                </p>
                <p className="text-[11px] font-normal text-amber-700/90 dark:text-amber-300/90 leading-relaxed">
                  {controle.motivoDivergencia ||
                    'A quantidade de venda dos últimos 30 dias variou ou diminuiu. Como este indicador utiliza uma janela móvel de 30 dias, a quantidade controlada não foi alterada automaticamente para evitar inconsistências.'}
                </p>
              </div>
            )}
          </div>

          {/* Timeline of Import Movements */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500" />
              Registro de Importações e Vendas Identificadas
            </h4>

            {loading ? (
              <p className="text-xs text-slate-400 text-center py-4">Carregando histórico...</p>
            ) : movimentacoes.length === 0 ? (
              <div className="p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Nenhuma movimentação registrada por importação posterior.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Quando uma nova planilha Excel for importada e a "Quantidade de Venda 30 Dias" for maior que a anterior, a venda calculada e o abatimento no vencimento mais próximo aparecerão aqui automaticamente.
                </p>
              </div>
            ) : (
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {movimentacoes.map((m) => {
                  const venda = m.vendaIdentificada ?? m.movimentacaoIdentificada ?? 0;
                  const teveVenda = venda > 0;
                  const vendaFmt = formatarVendaIdentificada(
                    venda,
                    controle.unidadeControle,
                    controle.unidadesPorCaixa
                  );
                  const qtdAnteriorFmt = formatarQuantidade(
                    m.quantidadeAnterior,
                    controle.unidadeControle,
                    false,
                    controle.unidadesPorCaixa
                  );
                  const qtdNovaFmt = formatarQuantidade(
                    m.quantidadeNova,
                    controle.unidadeControle,
                    false,
                    controle.unidadesPorCaixa
                  );

                  return (
                    <div
                      key={m.id}
                      className="relative pl-7 bg-white dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2"
                    >
                      <div className="absolute left-1.5 top-4 w-3 h-3 rounded-full bg-amber-500 border-2 border-white dark:border-slate-900"></div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-500" /> {m.dataHora}
                        </span>
                        {teveVenda ? (
                          <span className="font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" /> Venda Identificada: -{vendaFmt}
                          </span>
                        ) : m.alertaDivergencia ? (
                          <span className="font-extrabold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            ⚠️ Variação na Venda 30 Dias
                          </span>
                        ) : (
                          <span className="font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
                            Sem vendas no período
                          </span>
                        )}
                      </div>

                      {m.alertaDivergencia && m.motivoDivergencia && (
                        <div className="p-2 bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 rounded-xl text-[11px]">
                          ⚠️ {m.motivoDivergencia}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        <div>
                          <span className="text-[10px] uppercase text-slate-400 font-bold block">
                            Venda 30 Dias (Excel)
                          </span>
                          <p className="font-mono text-slate-700 dark:text-slate-300">
                            Anterior: <span className="font-bold">{m.venda30DiasAnterior ?? '—'}</span>
                          </p>
                          <p className="font-mono text-slate-700 dark:text-slate-300">
                            Atual: <span className="font-bold text-indigo-600 dark:text-indigo-400">{m.venda30DiasAtual ?? '—'}</span>
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase text-slate-400 font-bold block">
                            Qtd Próxima do Vencimento
                          </span>
                          <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                            <span>{qtdAnteriorFmt}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="text-amber-600 dark:text-amber-400">{qtdNovaFmt}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
