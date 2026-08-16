import React, { useState } from 'react';
import type { ControleVencimento, Produto, StatusVencimento } from '../types';
import { formatarDataBR, formatarMoeda, getStatusConfig, getPriorityColor, parsePrecoString } from '../utils/date';
import { formatarQuantidade } from '../utils/quantity';
import { criarCartazItemDeProduto } from '../utils/cartazes';
import { gerarPdfCartazes } from '../utils/pdfCartazes';
import {
  Search,
  Filter,
  ArrowUpDown,
  Edit,
  Trash2,
  History,
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Tag,
  Printer,
  CheckSquare,
  Square,
} from 'lucide-react';

interface TabelaProdutosProps {
  controles: ControleVencimento[];
  produtosMap: Map<string, Produto>;
  onEditControle: (controle: ControleVencimento) => void;
  onDeleteControle: (id: number) => void;
  onViewHistory: (controle: ControleVencimento) => void;
  onUpdatePrecoTrabalhado: (controleId: number, novoPreco: number | null) => void;
  onNavigateToCartazes?: () => void;
  initialFilterStatus?: string;
}

export const TabelaProdutos: React.FC<TabelaProdutosProps> = ({
  controles,
  produtosMap,
  onEditControle,
  onDeleteControle,
  onViewHistory,
  onUpdatePrecoTrabalhado,
  onNavigateToCartazes,
  initialFilterStatus = 'TODOS',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>(initialFilterStatus);
  const [filterComprador, setFilterComprador] = useState<string>('TODOS');
  const [sortBy, setSortBy] = useState<'DATA_VENCIMENTO' | 'CODIGO' | 'DESCRICAO' | 'PRIORIDADE'>(
    'DATA_VENCIMENTO'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Selected items for bulk poster printing
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Inline Price Editing State
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [editingPriceInput, setEditingPriceInput] = useState<string>('');

  // Extract unique Comprador Filial values for filter dropdown
  const compradoresFiliais = Array.from(
    new Set(Array.from(produtosMap.values()).map((p: Produto) => p.compradorFilial).filter(Boolean))
  );

  // Filter & Search Logic
  const filteredControles = controles.filter((c) => {
    const produto = produtosMap.get(c.produtoId);

    // Search term check
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const codeMatch = c.codigo.toLowerCase().includes(term);
      const digMatch = c.dig.toLowerCase().includes(term);
      const descMatch = produto?.descricao?.toLowerCase().includes(term);
      const embMatch = produto?.embalagem?.toLowerCase().includes(term);
      const compMatch = produto?.compradorFilial?.toLowerCase().includes(term);

      if (!codeMatch && !digMatch && !descMatch && !embMatch && !compMatch) {
        return false;
      }
    }

    // Status filter check
    if (filterStatus !== 'TODOS' && c.status !== filterStatus) {
      return false;
    }

    // Comprador Filial check
    if (filterComprador !== 'TODOS' && produto?.compradorFilial !== filterComprador) {
      return false;
    }

    return true;
  });

  // Sorting Logic
  const sortedControles = [...filteredControles].sort((a, b) => {
    const pA = produtosMap.get(a.produtoId);
    const pB = produtosMap.get(b.produtoId);

    let comp = 0;
    if (sortBy === 'DATA_VENCIMENTO') {
      comp = a.dataVencimento.localeCompare(b.dataVencimento);
    } else if (sortBy === 'CODIGO') {
      comp = parseInt(a.codigo, 10) - parseInt(b.codigo, 10);
    } else if (sortBy === 'DESCRICAO') {
      comp = (pA?.descricao || '').localeCompare(pB?.descricao || '');
    } else if (sortBy === 'PRIORIDADE') {
      const cfgA = getStatusConfig(a.status);
      const cfgB = getStatusConfig(b.status);
      comp = cfgA.priority - cfgB.priority;
    }

    return sortOrder === 'asc' ? comp : -comp;
  });

  const handleStartEditPrice = (controle: ControleVencimento) => {
    setEditingPriceId(controle.id!);
    setEditingPriceInput(
      controle.precoTrabalhado !== null && controle.precoTrabalhado !== undefined
        ? String(controle.precoTrabalhado).replace('.', ',')
        : ''
    );
  };

  // Bulk selection helpers
  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === sortedControles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedControles.map((c) => c.id!).filter(Boolean)));
    }
  };

  const handleSelectCriticos = () => {
    const criticos = sortedControles
      .filter((c) => c.status === 'VENCIDO' || c.status === 'VENCE_HOJE' || c.status === 'VENCE_3_DIAS' || c.status === 'VENCE_7_DIAS')
      .map((c) => c.id!)
      .filter(Boolean);
    setSelectedIds(new Set(criticos));
  };

  // Generate Posters in Bulk directly from table
  const handleImprimirCartazesSelecionados = () => {
    const itensToPrint = sortedControles
      .filter((c) => selectedIds.has(c.id!))
      .map((c) => {
        const prod = produtosMap.get(c.produtoId);
        if (!prod) return null;
        return criarCartazItemDeProduto(prod, c);
      })
      .filter(Boolean) as any[];

    if (itensToPrint.length === 0) {
      alert('Selecione ao menos um produto para imprimir cartazes.');
      return;
    }

    gerarPdfCartazes(itensToPrint, {
      layout: '1_POR_PAGINA',
      tituloCabecalho: 'OFERTA ESPECIAL',
      destacarVencimento: true,
    });
  };

  // Generate Poster for a single item
  const handleImprimirCartazUnico = (controle: ControleVencimento) => {
    const prod = produtosMap.get(controle.produtoId);
    if (!prod) return;
    const cartazItem = criarCartazItemDeProduto(prod, controle);
    gerarPdfCartazes([cartazItem], {
      layout: '1_POR_PAGINA',
      tituloCabecalho: 'OFERTA ESPECIAL',
      destacarVencimento: true,
    });
  };

  const handleSavePrice = (controleId: number) => {
    if (!editingPriceInput.trim()) {
      onUpdatePrecoTrabalhado(controleId, null);
    } else {
      const val = parsePrecoString(editingPriceInput);
      onUpdatePrecoTrabalhado(controleId, val);
    }
    setEditingPriceId(null);
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Pesquisar por código, descrição, embalagem ou comprador/filial..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Filters Group */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="VENCIDO">🔴 Vencidos</option>
                <option value="VENCE_HOJE">🟠 Vence Hoje</option>
                <option value="VENCE_3_DIAS">🟡 Vence em até 3 Dias</option>
                <option value="VENCE_7_DIAS">🟡 Vence em até 7 Dias</option>
                <option value="MAIS_7_DIAS">🟢 Mais de 7 Dias</option>
              </select>
            </div>

            {/* Comprador Filial Filter */}
            {compradoresFiliais.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5">
                <select
                  value={filterComprador}
                  onChange={(e) => setFilterComprador(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer max-w-[160px] truncate"
                >
                  <option value="TODOS">Todos Compradores/Filiais</option>
                  {compradoresFiliais.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="DATA_VENCIMENTO">Data Vencimento</option>
                <option value="PRIORIDADE">Prioridade de Vencimento</option>
                <option value="CODIGO">Código do Produto</option>
                <option value="DESCRICAO">Descrição</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:opacity-80 px-1"
                title="Inverter Ordem"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {/* Counter Results & Quick Selection Toolbar */}
        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-700/60 pt-2">
          <div className="flex items-center gap-2">
            <span>
              Exibindo <strong className="text-slate-900 dark:text-white">{sortedControles.length}</strong> de{' '}
              {controles.length} produtos em controle.
            </span>
            {selectedIds.size > 0 && (
              <span className="bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-full font-bold">
                {selectedIds.size} selecionados para cartaz
              </span>
            )}
          </div>

          {/* Quick Selection Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleToggleSelectAll}
              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors"
            >
              {selectedIds.size === sortedControles.length && sortedControles.length > 0
                ? 'Desmarcar Todos'
                : 'Marcar Todos'}
            </button>
            <button
              onClick={handleSelectCriticos}
              className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950/80 hover:bg-amber-200 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-bold transition-colors"
            >
              ⚡ Marcar Críticos (≤ 7d)
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={handleImprimirCartazesSelecionados}
                className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-md transition-all active:scale-95"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>IMPRIMIR {selectedIds.size} CARTAZES</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Table & Mobile Cards */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Table View (Desktop md+) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-3 py-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === sortedControles.length}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                    title="Marcar / Desmarcar todos"
                  />
                </th>
                <th className="px-3 py-3 text-center">CÓDIGO</th>
                <th className="px-2 py-3 text-center">DIG</th>
                <th className="px-4 py-3">DESCRIÇÃO MERCADORIA</th>
                <th className="px-3 py-3">EMBALAGEM</th>
                <th className="px-3 py-3">COMPRADOR FILIAL</th>
                <th className="px-2 py-3 text-center">ESTOQUE ATUAL</th>
                <th className="px-3 py-3 text-center">QTD PRÓX. VENC.</th>
                <th className="px-3 py-3 text-center">DATA VENC.</th>
                <th className="px-3 py-3 text-right">PREÇO TRABALHADO</th>
                <th className="px-3 py-3 text-center">STATUS</th>
                <th className="px-3 py-3 text-center">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {sortedControles.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-slate-500">
                    Nenhum produto próximo do vencimento encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                sortedControles.map((item) => {
                  const produto = produtosMap.get(item.produtoId);
                  const statusCfg = getStatusConfig(item.status);
                  const prioColor = getPriorityColor(item.dataVencimento, item.precoTrabalhado);
                  const isChecked = selectedIds.has(item.id!);

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isChecked
                          ? 'bg-rose-50/50 dark:bg-rose-950/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                      }`}
                    >
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelect(item.id!)}
                          className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-3 text-center font-mono font-black text-slate-900 dark:text-white">
                        {item.codigo}
                      </td>
                      <td className="px-2 py-3 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                        {item.dig || '-'}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100 max-w-xs truncate">
                        {produto?.descricao || '-'}
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {produto?.embalagem || '-'}
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {produto?.compradorFilial || '-'}
                      </td>
                      <td className="px-2 py-3 text-center font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <span className="text-[11px] font-bold">
                          {produto?.estoqueEmb1 || '0'} <span className="text-slate-400">/</span> {produto?.estoqueEmb9 || '0'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-xs bg-amber-50 dark:bg-amber-950/80 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                          {formatarQuantidade(item.quantidadeAtual, item.unidadeControle, false, item.unidadesPorCaixa)}
                        </span>
                        {item.alertaDivergencia && (
                          <span
                            className="block text-[9px] font-extrabold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/80 px-1.5 py-0.5 rounded mt-1 shadow-2xs cursor-pointer"
                            onClick={() => onViewHistory(item)}
                            title={item.motivoDivergencia || '⚠️ Variação na Venda 30 Dias ou divergência identificada na importação'}
                          >
                            ⚠️ {item.motivoDivergencia ? 'Atenção' : 'Var. Venda 30D'}
                          </span>
                        )}
                        {!item.alertaDivergencia && item.alertaMovimentacaoSuperior && (
                          <span
                            className="block text-[9px] font-extrabold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/80 px-1.5 py-0.5 rounded mt-1 shadow-2xs"
                            title="⚠️ Movimentação do estoque foi maior que a quantidade controlada"
                          >
                            ⚠️ Mov. Superior
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black border shadow-2xs ${prioColor.bgClass} ${prioColor.textClass} ${prioColor.borderClass}`}
                        >
                          {formatarDataBR(item.dataVencimento)}
                        </span>
                      </td>

                      {/* Inline Editable Preço Trabalhado */}
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {editingPriceId === item.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="text"
                              value={editingPriceInput}
                              onChange={(e) => setEditingPriceInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSavePrice(item.id!)}
                              placeholder="14,90"
                              className="w-20 bg-slate-100 dark:bg-slate-950 border border-amber-500 rounded px-1.5 py-0.5 text-right font-mono text-xs focus:outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSavePrice(item.id!)}
                              className="text-emerald-600 hover:text-emerald-500 font-bold px-1"
                              title="Salvar Preço"
                            >
                              ✓
                            </button>
                          </div>
                        ) : (
                          <span
                            onClick={() => handleStartEditPrice(item)}
                            className={`inline-block cursor-pointer px-2.5 py-1 rounded-lg font-black text-xs transition-all ${
                              item.precoTrabalhado !== null && item.precoTrabalhado !== undefined
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                            }`}
                            title="Clique para editar o preço trabalhado"
                          >
                            {item.precoTrabalhado !== null && item.precoTrabalhado !== undefined
                              ? formatarMoeda(item.precoTrabalhado)
                              : 'R$ -- (Editar)'}
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${statusCfg.bgClass} ${statusCfg.textClass} ${statusCfg.borderClass}`}
                        >
                          <span>{statusCfg.icon}</span>
                          <span>{statusCfg.label}</span>
                        </span>
                      </td>

                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {/* Quick Print Poster Button */}
                          <button
                            onClick={() => handleImprimirCartazUnico(item)}
                            className="p-1.5 text-emerald-600 hover:text-white hover:bg-emerald-600 dark:hover:bg-emerald-600 rounded-lg transition-colors"
                            title="Imprimir Cartaz TAGG Oficial deste produto"
                          >
                            <Tag className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onViewHistory(item)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Ver Histórico de Movimentações"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onEditControle(item)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Editar Controle"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteControle(item.id!)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Excluir do Controle"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Responsive Cards View (Below md breakpoint) */}
        <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-700/60">
          {sortedControles.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Nenhum produto próximo do vencimento encontrado.
            </div>
          ) : (
            sortedControles.map((item) => {
              const produto = produtosMap.get(item.produtoId);
              const statusCfg = getStatusConfig(item.status);
              const prioColor = getPriorityColor(item.dataVencimento, item.precoTrabalhado);
              const qtdVencFmt = formatarQuantidade(item.quantidadeAtual, item.unidadeControle, false, item.unidadesPorCaixa);
              const isChecked = selectedIds.has(item.id!);

              return (
                <div key={item.id} className={`p-4 space-y-3 ${isChecked ? 'bg-rose-50/50 dark:bg-rose-950/20' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 flex-1">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleSelect(item.id!)}
                        className="mt-1 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                            CÓD: {item.codigo} - {item.dig}
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${statusCfg.bgClass} ${statusCfg.textClass} ${statusCfg.borderClass}`}
                          >
                            {statusCfg.label}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {produto?.descricao || '-'}
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Embalagem</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{produto?.embalagem || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Comprador Filial</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{produto?.compradorFilial || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Estoque EMB1/EMB9</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {produto?.estoqueEmb1 || 0} / {produto?.estoqueEmb9 || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Qtd Próx. Venc.</span>
                      <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-xs">
                        {qtdVencFmt}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Vencimento</span>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-black border ${prioColor.bgClass} ${prioColor.textClass} ${prioColor.borderClass}`}>
                        {formatarDataBR(item.dataVencimento)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Preço Trab.</span>
                      <span
                        onClick={() => handleStartEditPrice(item)}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 cursor-pointer underline"
                      >
                        {item.precoTrabalhado !== null && item.precoTrabalhado !== undefined
                          ? formatarMoeda(item.precoTrabalhado)
                          : 'R$ -- (Editar)'}
                      </span>
                    </div>
                  </div>

                  {item.alertaDivergencia && (
                    <div
                      onClick={() => onViewHistory(item)}
                      className="p-2 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 rounded-xl text-[11px] font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1.5 cursor-pointer"
                    >
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>⚠️ {item.motivoDivergencia || 'VARIAÇÃO NA VENDA 30 DIAS'}</span>
                    </div>
                  )}

                  {!item.alertaDivergencia && item.alertaMovimentacaoSuperior && (
                    <div className="p-2 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 rounded-xl text-[11px] font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>⚠️ MOVIMENTAÇÃO SUPERIOR À QUANTIDADE CONTROLADA</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => handleImprimirCartazUnico(item)}
                      className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-black flex items-center gap-1"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>Cartaz TAGG</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onViewHistory(item)}
                        className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl"
                        title="Histórico"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEditControle(item)}
                        className="p-2 bg-amber-500 text-slate-950 rounded-xl font-bold"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteControle(item.id!)}
                        className="p-2 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-xl"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
