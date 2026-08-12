import React from 'react';
import type { ControleVencimento, Produto } from '../types';
import { formatarDataBR } from '../utils/date';
import { formatarQuantidade } from '../utils/quantity';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';

interface AlertExpiredModalProps {
  isOpen: boolean;
  expiredItems: ControleVencimento[];
  produtosMap: Map<string, Produto>;
  onClose: () => void;
  onViewProducts: () => void;
}

export const AlertExpiredModal: React.FC<AlertExpiredModalProps> = ({
  isOpen,
  expiredItems,
  produtosMap,
  onClose,
  onViewProducts,
}) => {
  if (!isOpen || expiredItems.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border-2 border-red-500 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-900 dark:text-white my-8">
        {/* Header */}
        <div className="px-5 py-4 bg-red-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
            <h3 className="font-extrabold text-lg">⚠️ ATENÇÃO</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-red-700 text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
            <span className="text-red-600 dark:text-red-400 font-black text-base">{expiredItems.length}</span>{' '}
            {expiredItems.length === 1 ? 'produto passou' : 'produtos passaram'} para <strong className="text-red-600 dark:text-red-400 uppercase">VENCIDO(S)</strong>.
          </p>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Abaixo estão os produtos com data de vencimento ultrapassada. Tome as providências necessárias no estoque.
          </p>

          {/* List preview */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl max-h-52 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-950">
            {expiredItems.slice(0, 5).map((item) => {
              const produto = produtosMap.get(item.produtoId);
              const qtdFmt = formatarQuantidade(item.quantidadeAtual, item.unidadeControle);

              return (
                <div key={item.id} className="py-2.5 px-3 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-mono font-bold text-red-600 dark:text-red-400 text-[11px] block">
                      CÓD: {item.codigo} - {item.dig}
                    </span>
                    <h5 className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-xs">
                      {produto?.descricao || 'Produto'}
                    </h5>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 block">Vencido em</span>
                    <span className="font-extrabold text-red-600 dark:text-red-400">{formatarDataBR(item.dataVencimento)}</span>
                  </div>
                </div>
              );
            })}

            {expiredItems.length > 5 && (
              <p className="p-2 text-center text-xs font-semibold text-slate-500">
                ... e mais {expiredItems.length - 5} produtos vencidos.
              </p>
            )}
          </div>

          {/* Action button */}
          <div className="pt-2">
            <button
              onClick={() => {
                onClose();
                onViewProducts();
              }}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-xl text-sm transition-colors shadow active:scale-95 flex items-center justify-center gap-2"
            >
              <span>VER PRODUTOS VENCIDOS</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
