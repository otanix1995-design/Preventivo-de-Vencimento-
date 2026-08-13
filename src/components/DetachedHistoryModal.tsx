import React, { useEffect, useState } from 'react';
import { db } from '../db/database';
import type { ControleVencimento, Produto, HistoricoMovimentacao } from '../types';
import { formatarDataBR, formatarMoeda } from '../utils/date';
import { formatarQuantidade } from '../utils/quantity';
import { History, X, Clock, TrendingDown, ArrowRight, FileSpreadsheet } from 'lucide-react';

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

  const qtdInicialFmt = formatarQuantidade(controle.quantidadeInicial, controle.unidadeControle);
  const qtdAtualFmt = formatarQuantidade(controle.quantidadeAtual, controle.unidadeControle);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl text-slate-900 dark:text-white my-8">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base">Histórico de Movimentações</h3>
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
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Estoque Atual Excel</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {produto?.estoqueEmb1 || 0} / {produto?.estoqueEmb9 || 0}
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
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Preço Trabalhado</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatarMoeda(controle.precoTrabalhado)}
                </span>
              </div>
            </div>

            {controle.alertaMovimentacaoSuperior && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 rounded-xl text-xs font-bold text-amber-800 dark:text-amber-200 space-y-1">
                <p className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                  <span>⚠️</span>
                  <span>MOVIMENTAÇÃO SUPERIOR À QUANTIDADE CONTROLADA</span>
                </p>
                <p className="text-[11px] font-normal text-amber-700/80 dark:text-amber-300/80">
                  A movimentação de estoque identificada na última importação foi maior que a quantidade mantida neste controle. A quantidade controlada foi zerada para evitar estoque negativo. Favor revisar.
                </p>
              </div>
            )}
          </div>

          {/* Timeline of Import Movements */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500" />
              Registro de Movimentações em Planilhas Importadas
            </h4>

            {loading ? (
              <p className="text-xs text-slate-400 text-center py-4">Carregando histórico...</p>
            ) : movimentacoes.length === 0 ? (
              <div className="p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Nenhuma movimentação de estoque registrada por importação posterior.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Quando uma nova planilha Excel for importada e houver variação no estoque deste produto, a movimentação e o desconto serão listados aqui automaticamente.
                </p>
              </div>
            ) : (
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {movimentacoes.map((m) => {
                  const isReducao = m.movimentacaoIdentificada > 0;
                  const absMov = Math.abs(m.movimentacaoIdentificada);
                  const movFmt = formatarQuantidade(absMov, controle.unidadeControle);
                  const qtdAnteriorFmt = formatarQuantidade(m.quantidadeAnterior, controle.unidadeControle);
                  const qtdNovaFmt = formatarQuantidade(m.quantidadeNova, controle.unidadeControle);

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
                        {isReducao ? (
                          <span className="font-extrabold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" /> Movimentação (Saída): -{movFmt}
                          </span>
                        ) : (
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <span>↑</span> Aumento de Estoque: +{movFmt}
                          </span>
                        )}
                      </div>

                      {m.alertaMovimentacaoSuperior && (
                        <div className="p-2 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 rounded-lg text-[10px] font-extrabold">
                          ⚠️ MOVIMENTAÇÃO SUPERIOR À QUANTIDADE CONTROLADA
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        <div>
                          <span className="text-[10px] uppercase text-slate-400 font-bold block">
                            Estoque Excel (EMB1 / EMB9)
                          </span>
                          <p className="font-mono text-slate-700 dark:text-slate-300">
                            Anterior: {m.estoqueAnteriorEmb1} / {m.estoqueAnteriorEmb9}
                          </p>
                          <p className="font-mono text-slate-700 dark:text-slate-300">
                            Atual: {m.estoqueAtualEmb1} / {m.estoqueAtualEmb9}
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
