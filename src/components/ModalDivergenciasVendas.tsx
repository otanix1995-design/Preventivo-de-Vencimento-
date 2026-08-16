import React, { useState, useEffect } from 'react';
import { db } from '../db/database';
import type { DivergenciaVenda, AuditoriaFefo, StatusVendaReal } from '../types';
import { formatarDataBR } from '../utils/date';
import {
  AlertTriangle,
  X,
  Search,
  Filter,
  CheckCircle2,
  FileSpreadsheet,
  Clock,
  Boxes,
  TrendingDown,
  Layers,
  ShieldAlert,
  ArrowRight,
  Info,
} from 'lucide-react';

interface ModalDivergenciasVendasProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalDivergenciasVendas: React.FC<ModalDivergenciasVendasProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'divergencias' | 'auditoria'>('divergencias');
  const [divergencias, setDivergencias] = useState<DivergenciaVenda[]>([]);
  const [auditorias, setAuditorias] = useState<AuditoriaFefo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('TODAS');

  useEffect(() => {
    if (!isOpen) return;
    loadData();
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    const [divs, auds] = await Promise.all([
      db.divergenciasVendas.orderBy('id').reverse().toArray(),
      db.auditoriaFefo.orderBy('id').reverse().toArray(),
    ]);
    setDivergencias(divs);
    setAuditorias(auds);
    setLoading(false);
  };

  if (!isOpen) return null;

  // Filtered divergences
  const filteredDivs = divergencias.filter((d) => {
    const matchStatus = statusFilter === 'TODAS' || d.status === statusFilter;
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      !term ||
      d.codigo.toLowerCase().includes(term) ||
      (d.dig && d.dig.toLowerCase().includes(term)) ||
      (d.codigoOriginal && d.codigoOriginal.toLowerCase().includes(term)) ||
      (d.descricao && d.descricao.toLowerCase().includes(term)) ||
      (d.motivo && d.motivo.toLowerCase().includes(term)) ||
      (d.cupom && d.cupom.toLowerCase().includes(term)) ||
      (d.pdv && d.pdv.toLowerCase().includes(term));

    return matchStatus && matchSearch;
  });

  // Filtered audits
  const filteredAuds = auditorias.filter((a) => {
    const term = searchTerm.toLowerCase().trim();
    return (
      !term ||
      a.codigo.toLowerCase().includes(term) ||
      (a.dig && a.dig.toLowerCase().includes(term)) ||
      (a.descricao && a.descricao.toLowerCase().includes(term))
    );
  });

  const countNaoEncontrado = divergencias.filter((d) => d.status === 'PRODUTO_NAO_ENCONTRADO').length;
  const countEmbalagem = divergencias.filter((d) => d.status === 'EMBALAGEM_NAO_INTERPRETADA').length;
  const countExcedente = divergencias.filter((d) => d.status === 'VENDA_EXCEDENTE').length;
  const countOutras = divergencias.length - countNaoEncontrado - countEmbalagem - countExcedente;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl text-slate-900 dark:text-white my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight">DIVERGÊNCIAS E AUDITORIA DE VENDAS</h3>
              <p className="text-[11px] text-slate-400">
                Monitoramento seguro de inconsistências e rastreabilidade FEFO do SASOI061
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

        {/* Tabs Bar */}
        <div className="px-5 pt-3 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('divergencias')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'divergencias'
                ? 'bg-white dark:bg-slate-900 border-amber-500 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Divergências de Vendas</span>
            {divergencias.length > 0 && (
              <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-black">
                {divergencias.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('auditoria')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'auditoria'
                ? 'bg-white dark:bg-slate-900 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4 text-emerald-500" />
            <span>Auditoria FEFO (Descontos)</span>
            {auditorias.length > 0 && (
              <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-black">
                {auditorias.length}
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Summary Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 p-3 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Divergências</span>
              <span className="text-lg font-black text-amber-500">{divergencias.length}</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 p-3 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Prod. Não Encontrado</span>
              <span className="text-lg font-black text-red-500">{countNaoEncontrado}</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 p-3 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Embalagem Não Interpr.</span>
              <span className="text-lg font-black text-orange-500">{countEmbalagem}</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 p-3 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Venda Excedente</span>
              <span className="text-lg font-black text-indigo-500">{countExcedente}</span>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por código, DIG, descrição, cupom ou motivo..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            {activeTab === 'divergencias' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-amber-500 text-slate-700 dark:text-slate-300"
              >
                <option value="TODAS">Todos os Tipos de Divergência</option>
                <option value="PRODUTO_NAO_ENCONTRADO">Produto Não Encontrado</option>
                <option value="EMBALAGEM_NAO_INTERPRETADA">Embalagem Não Interpretada</option>
                <option value="DIG_NAO_RECONHECIDO">DIG Não Reconhecido</option>
                <option value="VENDA_EXCEDENTE">Venda Excedente</option>
                <option value="DIVERGENCIA">Divergência de Dados</option>
              </select>
            )}
          </div>

          {/* TAB 1: DIVERGENCIAS */}
          {activeTab === 'divergencias' && (
            <div className="space-y-3">
              {filteredDivs.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Nenhuma divergência pendente
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Todas as vendas importadas foram interpretadas e aplicadas sem inconsistências.
                  </p>
                </div>
              ) : (
                filteredDivs.map((d) => (
                  <div
                    key={d.id}
                    className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-2.5 transition-all hover:border-amber-400"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                            d.status === 'PRODUTO_NAO_ENCONTRADO'
                              ? 'bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border border-red-300'
                              : d.status === 'EMBALAGEM_NAO_INTERPRETADA'
                              ? 'bg-orange-100 dark:bg-orange-950/80 text-orange-800 dark:text-orange-300 border border-orange-300'
                              : d.status === 'VENDA_EXCEDENTE'
                              ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-300'
                              : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300'
                          }`}
                        >
                          ⚠️ {d.status.replace(/_/g, ' ')}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                          CÓD: {d.codigo} {d.dig ? `- DIG: ${d.dig}` : ''}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
                        <span>{d.dataVenda} {d.horaVenda || ''}</span>
                        {d.pdv && <span>• PDV: {d.pdv}</span>}
                        {d.cupom && <span>• Cupom: {d.cupom}</span>}
                        {d.seq && <span>• Seq: {d.seq}</span>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] block uppercase font-bold">Descrição no Relatório</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {d.descricao || '—'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[10px] block uppercase font-bold">Embalagem / Qtd Informada</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {d.embalagem || '—'} (Qtd: {d.qtd ?? d.qtdOriginal})
                        </span>
                      </div>
                    </div>

                    {/* Motive Box */}
                    <div className="p-2.5 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block text-[11px]">Motivo da Retenção:</strong>
                        <span>{d.motivo}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: AUDITORIA FEFO */}
          {activeTab === 'auditoria' && (
            <div className="space-y-3">
              {filteredAuds.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
                  <Clock className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Nenhum registro de dedução FEFO ainda
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Os descontos automáticos de vendas reais aplicados aos lotes de vencimento aparecerão aqui com rastreabilidade completa.
                  </p>
                </div>
              ) : (
                filteredAuds.map((a) => (
                  <div
                    key={a.id}
                    className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-200 dark:border-slate-700 pb-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                          CÓD: {a.codigo} - {a.descricao}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          Processado em: {a.dataHora} • {a.saleIds?.length || 0} cupons/itens de venda consolidados
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-black px-2.5 py-1 rounded-xl">
                          - {a.vendaTotalAplicada} {a.tipoControle === 'PESO' ? 'g' : 'un'} aplicados
                        </span>
                        {a.vendaExcedente > 0 && (
                          <span className="bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 text-xs font-black px-2.5 py-1 rounded-xl">
                            + {a.vendaExcedente} {a.tipoControle === 'PESO' ? 'g' : 'un'} excedente
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Breakdown of affected batches */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
                        Lotes de Vencimento Impactados (Ordem FEFO):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {a.detalhesVencimentos?.map((d, idx) => (
                          <div
                            key={idx}
                            className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between"
                          >
                            <div>
                              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                                Venc: {formatarDataBR(d.dataVencimento)}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Anterior: {d.qtdAntes} → Atual: {d.qtdDepois}
                              </span>
                            </div>

                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              - {d.descontoAplicado ?? d.qtdDescontada} {a.tipoControle === 'PESO' ? 'g' : 'un'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-right shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-300 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
