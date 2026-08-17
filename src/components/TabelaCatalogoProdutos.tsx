import React, { useState, useMemo } from 'react';
import type { Produto, ControleVencimento } from '../types';
import {
  Search,
  Filter,
  Package,
  PlusCircle,
  Eye,
  Info,
  Layers,
  ChevronLeft,
  ChevronRight,
  Database,
  X,
  Barcode,
  Link2,
} from 'lucide-react';

interface TabelaCatalogoProdutosProps {
  produtos: Produto[];
  controlesMap: Map<string, ControleVencimento[]>;
  onCadastrarVencimento: (produto: Produto) => void;
  onOpenEanManager?: () => void;
}

export const TabelaCatalogoProdutos: React.FC<TabelaCatalogoProdutosProps> = ({
  produtos,
  controlesMap,
  onCadastrarVencimento,
  onOpenEanManager,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedComprador, setSelectedComprador] = useState('TODOS');
  const [selectedExtraProduct, setSelectedExtraProduct] = useState<Produto | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Extract unique Compradores
  const compradores = useMemo(() => {
    const setC = new Set<string>();
    produtos.forEach((p) => {
      if (p.compradorFilial) setC.add(p.compradorFilial);
    });
    return Array.from(setC).sort();
  }, [produtos]);

  // Filter products
  const filteredProdutos = useMemo(() => {
    return produtos.filter((p) => {
      // Comprador filter
      if (selectedComprador !== 'TODOS' && p.compradorFilial !== selectedComprador) {
        return false;
      }

      // Search term
      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase();
      const matchCod = p.codigo.toLowerCase().includes(term);
      const matchDig = p.dig.toLowerCase().includes(term);
      const matchFullCode = `${p.codigo}-${p.dig}`.toLowerCase().includes(term);
      const matchDesc = p.descricao.toLowerCase().includes(term);
      const matchEmbal = p.embalagem.toLowerCase().includes(term);
      const matchComp = p.compradorFilial.toLowerCase().includes(term);

      // Check extra columns
      let matchExtra = false;
      if (p.outrasColunas) {
        matchExtra = Object.entries(p.outrasColunas).some(
          ([k, v]) => k.toLowerCase().includes(term) || String(v).toLowerCase().includes(term)
        );
      }

      return matchCod || matchDig || matchFullCode || matchDesc || matchEmbal || matchComp || matchExtra;
    });
  }, [produtos, selectedComprador, searchTerm]);

  // Pagination math
  const totalPages = Math.ceil(filteredProdutos.length / itemsPerPage) || 1;

  const paginatedProdutos = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProdutos.slice(start, start + itemsPerPage);
  }, [filteredProdutos, currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner / Summary */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Catálogo Geral de Produtos Importados
              <span className="bg-emerald-500 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full">
                {produtos.length} produtos
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Todos os produtos lidos do arquivo Excel estão armazenados aqui. Você pode pesquisar, visualizar colunas adicionais e cadastrar o controle de vencimento.
            </p>
          </div>
        </div>

        {onOpenEanManager && (
          <button
            onClick={onOpenEanManager}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-xs flex items-center gap-2 shadow-md shrink-0 transition-all active:scale-95 border border-amber-400/40"
          >
            <Barcode className="w-4 h-4" />
            <span>Vínculos EAN / Código de Barras</span>
          </button>
        )}
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-3 justify-between">
        {/* Search input */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Pesquisar por Código, Descrição, Comprador, etc..."
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

        {/* Comprador Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedComprador}
            onChange={(e) => {
              setSelectedComprador(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full md:w-64 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-amber-500"
          >
            <option value="TODOS">Todos os Compradores ({compradores.length})</option>
            {compradores.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {paginatedProdutos.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Package className="w-12 h-12 text-slate-400 mx-auto opacity-50" />
            <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm">
              Nenhum produto encontrado no catálogo
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {produtos.length === 0
                ? 'Importe uma planilha Excel (.xlsx) pelo botão no topo para carregar os produtos no sistema.'
                : 'Nenhum resultado corresponde aos filtros informados.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-extrabold text-[10px]">
                  <tr>
                    <th className="py-3 px-4">CÓDIGO / DIG</th>
                    <th className="py-3 px-4">DESCRIÇÃO MERCADORIA</th>
                    <th className="py-3 px-4">EMBALAGEM</th>
                    <th className="py-3 px-4">COMPRADOR FILIAL</th>
                    <th className="py-3 px-4 text-center">ESTOQUE EMB1 / EMB9</th>
                    <th className="py-3 px-4 text-center">VENDA 30 DIAS</th>
                    <th className="py-3 px-4 text-center">OUTRAS COLUNAS</th>
                    <th className="py-3 px-4 text-right">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {paginatedProdutos.map((p) => {
                    const controlesDoProduto = controlesMap.get(p.id) || [];
                    const temControle = controlesDoProduto.length > 0;
                    const extraCount = p.outrasColunas ? Object.keys(p.outrasColunas).length : 0;

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-850 transition-colors"
                      >
                        {/* Code */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100 block">
                            {p.codigo} - {p.dig || '000'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {p.codigoOriginal}
                          </span>
                        </td>

                        {/* Description */}
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 dark:text-slate-100 block max-w-xs sm:max-w-md truncate">
                            {p.descricao}
                          </span>
                        </td>

                        {/* Embalagem */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-slate-700 dark:text-slate-300 font-mono text-[11px] block">
                            {p.embalagem || 'N/A'}
                          </span>
                          <span
                            className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                              p.tipoControle === 'PESO'
                                ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                                : p.tipoControle === 'UNIDADE'
                                ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {p.tipoControle === 'PESO'
                              ? 'PESO (KG/G)'
                              : p.tipoControle === 'UNIDADE'
                              ? 'UNIDADE'
                              : 'INDEFINIDO'}
                          </span>
                        </td>

                        {/* Comprador */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-slate-600 dark:text-slate-300 text-xs">
                            {p.compradorFilial || 'Sem comprador'}
                          </span>
                        </td>

                        {/* Stock */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                            {p.estoqueEmb1 || '0'} <span className="text-slate-400 font-normal">/</span> {p.estoqueEmb9 || '0'}
                          </div>
                        </td>

                        {/* Venda 30 Dias */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900">
                            {p.venda30Dias || '—'}
                          </span>
                        </td>

                        {/* Outras Colunas Badge */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {extraCount > 0 ? (
                            <button
                              onClick={() => setSelectedExtraProduct(p)}
                              className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{extraCount} colunas extras</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Nenhuma</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {temControle && (
                              <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                                {controlesDoProduto.length} Lote(s) em Vencimento
                              </span>
                            )}

                            <button
                              onClick={() => onCadastrarVencimento(p)}
                              className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shadow transition-all active:scale-95"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              <span>+ VENCIMENTO</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
              {paginatedProdutos.map((p) => {
                const controlesDoProduto = controlesMap.get(p.id) || [];
                const temControle = controlesDoProduto.length > 0;
                const extraCount = p.outrasColunas ? Object.keys(p.outrasColunas).length : 0;

                return (
                  <div key={p.id} className="p-3 sm:p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="text-xs font-mono font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            {p.codigo} - {p.dig || '000'}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              p.tipoControle === 'PESO'
                                ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                                : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                            }`}
                          >
                            {p.tipoControle === 'PESO' ? 'PESO' : 'UNID'}
                          </span>
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white break-words leading-tight">
                          {p.descricao}
                        </h4>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Embalagem</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block">{p.embalagem || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Comprador Filial</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block">{p.compradorFilial || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Estoque EMB1/EMB9</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300 block">
                          {p.estoqueEmb1 || '0'} / {p.estoqueEmb9 || '0'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Venda 30 Dias</span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 block">
                          {p.venda30Dias || '—'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      {extraCount > 0 ? (
                        <button
                          onClick={() => setSelectedExtraProduct(p)}
                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{extraCount} cols extras</span>
                        </button>
                      ) : (
                        <div />
                      )}

                      <div className="flex items-center gap-1.5">
                        {temControle && (
                          <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold px-2 py-1 rounded-lg">
                            {controlesDoProduto.length} lote(s)
                          </span>
                        )}
                        <button
                          onClick={() => onCadastrarVencimento(p)}
                          className="bg-amber-500 text-slate-950 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 active:scale-95"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>+ Vencimento</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination Controls */}
        {filteredProdutos.length > itemsPerPage && (
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              Mostrando {(currentPage - 1) * itemsPerPage + 1} a{' '}
              {Math.min(currentPage * itemsPerPage, filteredProdutos.length)} de{' '}
              {filteredProdutos.length} produtos
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 font-bold text-slate-700 dark:text-slate-300">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Extra Columns Modal */}
      {selectedExtraProduct && selectedExtraProduct.outrasColunas && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-900 dark:text-white">
            <div className="px-5 py-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-base">Colunas Adicionais do Excel</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    CÓD: {selectedExtraProduct.codigo} - {selectedExtraProduct.dig}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedExtraProduct(null)}
                className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                {selectedExtraProduct.descricao}
              </h4>

              <div className="space-y-2">
                {Object.entries(selectedExtraProduct.outrasColunas).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                      {key}
                    </span>
                    <span className="font-mono font-extrabold text-slate-900 dark:text-slate-100 text-right">
                      {String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-right">
              <button
                onClick={() => setSelectedExtraProduct(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-300"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
