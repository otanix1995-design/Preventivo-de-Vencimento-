import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../db/database';
import type { Produto, ControleVencimento, CartazItem, OpcoesPdfCartaz, LayoutCartazPdf } from '../types';
import { formatarDataBR, formatarMoeda, getPriorityColor, getStatusConfig } from '../utils/date';
import { formatarQuantidade } from '../utils/quantity';
import {
  extrairMarca,
  extrairPrecoBaseProduto,
  calcularPrecoKg,
  criarCartazItemDeProduto,
  decomporDescricaoTag,
  formatarCodigoSemZeros,
} from '../utils/cartazes';
import { gerarPdfCartazes } from '../utils/pdfCartazes';
import {
  Tag,
  Search,
  Camera,
  Plus,
  Trash2,
  Eye,
  Calendar,
  Layers,
  Printer,
  Copy,
  AlertTriangle,
  Package,
  QrCode,
  CheckSquare,
  Square,
  CheckCircle2,
  Filter,
  ArrowUpDown,
  Sparkles,
  RefreshCw,
  X,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';

import { CartazTaggVisual } from './CartazTaggVisual';
import {
  getCustomTemplateImage,
  saveCustomTemplateImage,
  clearCustomTemplateImage,
} from '../utils/templateBackground';

interface ModuloCartazesProps {
  produtos: Produto[];
  controles: ControleVencimento[];
  onOpenScanner: (onFoundProduct: (prod: Produto, scannedEan: string) => void) => void;
}

export const ModuloCartazes: React.FC<ModuloCartazesProps> = ({
  produtos,
  controles,
  onOpenScanner,
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'CONTROLE_VENCIMENTO' | 'BUSCA_AVULSA'>('CONTROLE_VENCIMENTO');

  // Search & Filter state for Expiration Control view
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [onlyComPreco, setOnlyComPreco] = useState<boolean>(false);

  // Selected IDs from expiration control for bulk printing
  const [selectedControleIds, setSelectedControleIds] = useState<Set<number>>(new Set());

  // Per-item overrides for price & copies in the batch table
  const [customPrecos, setCustomPrecos] = useState<Record<number, number | null>>({});
  const [customCopiesMap, setCustomCopiesMap] = useState<Record<number, number>>({});

  // Manual search state
  const [manualSearchTerm, setManualSearchTerm] = useState('');
  const [selectedManualProduto, setSelectedManualProduto] = useState<Produto | null>(null);
  const [manualPrice, setManualPrice] = useState<string>('');
  const [manualDate, setManualDate] = useState<string>('');
  const [manualCopies, setManualCopies] = useState<number>(1);
  const [scannedEanForSelected, setScannedEanForSelected] = useState<string>('');

  // Ad-hoc posters added via search
  const [cartazesAvulsos, setCartazesAvulsos] = useState<CartazItem[]>([]);

  // PDF Configuration
  const [pdfLayout, setPdfLayout] = useState<LayoutCartazPdf>('1_POR_PAGINA');
  const [tituloCabecalho, setTituloCabecalho] = useState('OFERTA ESPECIAL');

  // Interactive Live Preview item
  const [previewCartaz, setPreviewCartaz] = useState<CartazItem | null>(null);
  const [hasCustomTemplate, setHasCustomTemplate] = useState<boolean>(() => !!getCustomTemplateImage());

  const handleUploadTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        saveCustomTemplateImage(dataUrl);
        setHasCustomTemplate(true);
        // Force re-render of preview
        setPreviewCartaz((prev) => (prev ? { ...prev } : null));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetTemplate = () => {
    clearCustomTemplateImage();
    setHasCustomTemplate(false);
    setPreviewCartaz((prev) => (prev ? { ...prev } : null));
  };

  // Map of products by ID
  const produtosMap = useMemo(() => {
    const map = new Map<string, Produto>();
    produtos.forEach((p) => map.set(p.id, p));
    return map;
  }, [produtos]);

  // EAN Map for fast barcode searching
  const [vinculosList, setVinculosList] = useState<{ ean: string; produtoId: string; codigo: string }[]>([]);

  useEffect(() => {
    db.vinculosEan.toArray().then((list) => {
      setVinculosList(list.map((v) => ({ ean: v.ean, produtoId: v.produtoId, codigo: v.codigo })));
    });
  }, []);

  // Filtered expiration items
  const filteredControles = useMemo(() => {
    return controles.filter((c) => {
      const prod = produtosMap.get(c.produtoId);

      // Status filter
      if (filterStatus !== 'TODOS' && c.status !== filterStatus) {
        return false;
      }

      // Only with custom price filter
      if (onlyComPreco && (c.precoTrabalhado === null || c.precoTrabalhado === undefined)) {
        return false;
      }

      // Text search
      if (filterSearch.trim()) {
        const term = filterSearch.trim().toUpperCase();
        const cod = c.codigo.toUpperCase();
        const desc = (prod?.descricao || '').toUpperCase();
        const emb = (prod?.embalagem || '').toUpperCase();
        const comp = (prod?.compradorFilial || '').toUpperCase();
        if (!cod.includes(term) && !desc.includes(term) && !emb.includes(term) && !comp.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [controles, produtosMap, filterStatus, onlyComPreco, filterSearch]);

  // Bulk selection actions
  const handleToggleSelectControle = (id: number) => {
    setSelectedControleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    if (selectedControleIds.size === filteredControles.length && filteredControles.length > 0) {
      setSelectedControleIds(new Set());
    } else {
      setSelectedControleIds(new Set(filteredControles.map((c) => c.id!).filter(Boolean)));
    }
  };

  const handleSelectCriticos = () => {
    const criticos = filteredControles
      .filter((c) => c.status === 'VENCIDO' || c.status === 'VENCE_HOJE' || c.status === 'VENCE_3_DIAS' || c.status === 'VENCE_7_DIAS')
      .map((c) => c.id!)
      .filter(Boolean);
    setSelectedControleIds(new Set(criticos));
  };

  const handleSelectComPreco = () => {
    const comPreco = filteredControles
      .filter((c) => c.precoTrabalhado !== null && c.precoTrabalhado !== undefined && c.precoTrabalhado > 0)
      .map((c) => c.id!)
      .filter(Boolean);
    setSelectedControleIds(new Set(comPreco));
  };

  const handleDeselectAll = () => {
    setSelectedControleIds(new Set());
  };

  // Convert selected expiration items to CartazItem array
  const itensCartazesSelecionados = useMemo(() => {
    const list: CartazItem[] = [];

    // From expiration control selection
    controles.forEach((c) => {
      if (selectedControleIds.has(c.id!)) {
        const prod = produtosMap.get(c.produtoId);
        if (prod) {
          const item = criarCartazItemDeProduto(prod, c);

          // Apply local override price if edited in this view
          if (customPrecos[c.id!] !== undefined) {
            item.precoVenda = customPrecos[c.id!];
            if (item.precoVenda && item.unidadesPorCaixa && item.unidadesPorCaixa > 1) {
              item.precoCaixa = Math.round(item.precoVenda * item.unidadesPorCaixa * 100) / 100;
            }
            if (item.precoVenda) {
              item.precoKg = calcularPrecoKg(item.precoVenda, item.embalagem);
            }
          }

          // Apply local copies override
          if (customCopiesMap[c.id!]) {
            item.quantidadeCartazes = customCopiesMap[c.id!];
          }

          list.push(item);
        }
      }
    });

    // Add ad-hoc posters
    cartazesAvulsos.forEach((item) => {
      list.push(item);
    });

    return list;
  }, [controles, produtosMap, selectedControleIds, customPrecos, customCopiesMap, cartazesAvulsos]);

  // Set default preview item whenever selections change
  useEffect(() => {
    if (itensCartazesSelecionados.length > 0) {
      setPreviewCartaz(itensCartazesSelecionados[0]);
    } else {
      setPreviewCartaz(null);
    }
  }, [itensCartazesSelecionados]);

  // Generate PDF for all selected items
  const handleGerarPdfLote = () => {
    if (itensCartazesSelecionados.length === 0) {
      alert('Selecione ao menos um produto no controle de vencimento para imprimir os cartazes.');
      return;
    }

    gerarPdfCartazes(itensCartazesSelecionados, {
      layout: pdfLayout,
      tituloCabecalho: tituloCabecalho || 'OFERTA ESPECIAL',
      destacarVencimento: true,
    });
  };

  // Generate PDF for a single item immediately
  const handleGerarPdfItemUnico = (controle: ControleVencimento) => {
    const prod = produtosMap.get(controle.produtoId);
    if (!prod) return;
    const cartaz = criarCartazItemDeProduto(prod, controle);
    gerarPdfCartazes([cartaz], {
      layout: pdfLayout,
      tituloCabecalho: tituloCabecalho || 'OFERTA ESPECIAL',
      destacarVencimento: true,
    });
  };

  // Manual search autocomplete
  const manualSearchResults = useMemo(() => {
    const term = manualSearchTerm.trim().toUpperCase();
    if (!term) return [];

    const cleanTerm = term.replace(/^0+/, '');
    const matchingVinculos = vinculosList.filter((v) => {
      const cleanV = v.ean.replace(/^0+/, '');
      return v.ean.includes(term) || (cleanTerm.length >= 4 && cleanV.includes(cleanTerm));
    });
    const eanMatchingProdIds = new Set<string>();
    matchingVinculos.forEach((v) => {
      if (v.produtoId) eanMatchingProdIds.add(v.produtoId);
      if (v.codigo) eanMatchingProdIds.add(v.codigo);
    });

    return produtos
      .filter((p) => {
        if (eanMatchingProdIds.has(p.id) || eanMatchingProdIds.has(p.codigo)) return true;
        if (p.codigo.includes(term) || (cleanTerm && p.codigo.includes(cleanTerm))) return true;
        if (p.codigoOriginal.toUpperCase().includes(term)) return true;
        if (p.descricao.toUpperCase().includes(term)) return true;
        return false;
      })
      .slice(0, 10);
  }, [manualSearchTerm, produtos, vinculosList]);

  const handleSelectManualProduto = (produto: Produto, ean?: string) => {
    setSelectedManualProduto(produto);
    setManualSearchTerm('');
    if (ean) setScannedEanForSelected(ean);

    // Find if has expiration
    const prodControle = controles.find((c) => c.produtoId === produto.id);
    if (prodControle) {
      setManualDate(prodControle.dataVencimento);
      if (prodControle.precoTrabalhado) {
        setManualPrice(prodControle.precoTrabalhado.toFixed(2));
      } else {
        const base = extrairPrecoBaseProduto(produto);
        setManualPrice(base ? base.toFixed(2) : '');
      }
    } else {
      setManualDate('');
      const base = extrairPrecoBaseProduto(produto);
      setManualPrice(base ? base.toFixed(2) : '');
    }
  };

  const handleAddManualAoLote = () => {
    if (!selectedManualProduto) return;

    const parsedPrice = parseFloat(manualPrice.replace(',', '.'));
    const precoVenda = !isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice : null;

    const prodControle = controles.find((c) => c.produtoId === selectedManualProduto.id);
    const item = criarCartazItemDeProduto(
      selectedManualProduto,
      prodControle || undefined,
      scannedEanForSelected || undefined
    );

    item.precoVenda = precoVenda;
    if (manualDate) {
      item.dataVencimento = manualDate;
    }
    item.quantidadeCartazes = Math.max(1, manualCopies || 1);

    if (precoVenda && item.unidadesPorCaixa && item.unidadesPorCaixa > 1) {
      item.precoCaixa = Math.round(precoVenda * item.unidadesPorCaixa * 100) / 100;
    }
    if (precoVenda) {
      item.precoKg = calcularPrecoKg(precoVenda, item.embalagem);
    }

    setCartazesAvulsos((prev) => [...prev, item]);
    setSelectedManualProduto(null);
    setManualPrice('');
    setManualDate('');
    setManualCopies(1);
    setScannedEanForSelected('');
    setActiveTab('CONTROLE_VENCIMENTO');
  };

  const handleTriggerScanner = () => {
    onOpenScanner((foundProd, scannedEan) => {
      handleSelectManualProduto(foundProd, scannedEan);
      setActiveTab('BUSCA_AVULSA');
    });
  };

  const totalCartazesImpressao = useMemo(() => {
    return itensCartazesSelecionados.reduce((acc, c) => acc + (c.quantidadeCartazes || 1), 0);
  }, [itensCartazesSelecionados]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Module Header */}
      <div className="bg-gradient-to-r from-red-700 via-rose-700 to-amber-700 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-red-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
              <Tag className="w-7 h-7 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md">
                  Módulo Integrado
                </span>
                <span className="text-xs text-rose-100 font-medium">
                  Impressão Automática em Lote
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
                🏷️ CARTAZES DE OFERTAS
              </h2>
              <p className="text-xs sm:text-sm text-rose-100/90 mt-1 max-w-2xl leading-relaxed">
                Todos os produtos cadastrados no <strong>Controle de Vencimento</strong> já estão listados abaixo. 
                Basta marcar os produtos desejados e clicar no botão de <strong>impressão em lote</strong> para gerar o PDF oficial TAGG.
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleTriggerScanner}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white text-rose-900 hover:bg-rose-50 rounded-xl text-xs font-black shadow-lg transition-all active:scale-95 border border-rose-200"
            >
              <Camera className="w-4 h-4 text-rose-600" />
              <span>ESCANEAR EAN</span>
            </button>
            <button
              onClick={handleGerarPdfLote}
              disabled={itensCartazesSelecionados.length === 0}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black shadow-lg transition-all active:scale-95 border ${
                itensCartazesSelecionados.length > 0
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-300 shadow-amber-900/30'
                  : 'bg-white/20 text-rose-200 border-white/10 cursor-not-allowed'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>IMPRIMIR SELECIONADOS ({itensCartazesSelecionados.length})</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-white/20">
          <button
            onClick={() => setActiveTab('CONTROLE_VENCIMENTO')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'CONTROLE_VENCIMENTO'
                ? 'bg-white text-rose-800 shadow-md'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>1. PRODUTOS DO CONTROLE DE VENCIMENTO ({controles.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('BUSCA_AVULSA')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'BUSCA_AVULSA'
                ? 'bg-white text-rose-800 shadow-md'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>2. ADICIONAR AVULSO / CATÁLOGO GERAL</span>
          </button>
        </div>
      </div>

      {/* TAB 1: CONTROLE DE VENCIMENTO (MAIN BATCH PRINT VIEW) */}
      {activeTab === 'CONTROLE_VENCIMENTO' && (
        <div className="space-y-4">
          {/* Filter & Batch Toolbar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filtrar por código, descrição, embalagem ou comprador..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Quick Status Dropdown */}
              <div className="flex flex-wrap items-center gap-2">
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

                <button
                  onClick={() => setOnlyComPreco(!onlyComPreco)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    onlyComPreco
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  💲 Apenas com Preço Trabalhado
                </button>
              </div>
            </div>

            {/* Quick Action Selection Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">
                  Exibindo <strong>{filteredControles.length}</strong> produtos ({selectedControleIds.size} marcados para impressão)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={handleSelectAllFiltered}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg font-bold"
                >
                  {selectedControleIds.size === filteredControles.length && filteredControles.length > 0
                    ? 'Desmarcar Todos'
                    : 'Marcar Todos Filtrados'}
                </button>
                <button
                  onClick={handleSelectCriticos}
                  className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950/80 hover:bg-amber-200 text-amber-800 dark:text-amber-300 rounded-lg font-bold"
                >
                  ⚡ Marcar Críticos (≤ 7d)
                </button>
                <button
                  onClick={handleSelectComPreco}
                  className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/80 hover:bg-emerald-200 text-emerald-800 dark:text-emerald-300 rounded-lg font-bold"
                >
                  ⚡ Marcar com Preço
                </button>
                {selectedControleIds.size > 0 && (
                  <button
                    onClick={handleDeselectAll}
                    className="px-2.5 py-1 bg-red-50 dark:bg-red-950/40 text-red-600 rounded-lg font-bold"
                  >
                    Limpar Seleção
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table of Expiration Products */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-3 py-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={selectedControleIds.size > 0 && selectedControleIds.size === filteredControles.length}
                        onChange={handleSelectAllFiltered}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                        title="Marcar / Desmarcar todos"
                      />
                    </th>
                    <th className="px-3 py-3 text-center">CÓDIGO</th>
                    <th className="px-4 py-3">DESCRIÇÃO & MARCA</th>
                    <th className="px-3 py-3">EMBALAGEM</th>
                    <th className="px-3 py-3 text-center">DATA VENCIMENTO</th>
                    <th className="px-3 py-3 text-right">PREÇO CARTAZ (R$)</th>
                    <th className="px-2 py-3 text-center">CÓPIAS</th>
                    <th className="px-3 py-3 text-center">STATUS</th>
                    <th className="px-3 py-3 text-center">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredControles.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                        Nenhum produto encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredControles.map((controle) => {
                      const prod = produtosMap.get(controle.produtoId);
                      const isChecked = selectedControleIds.has(controle.id!);
                      const statusCfg = getStatusConfig(controle.status);
                      const prioColor = getPriorityColor(controle.dataVencimento, controle.precoTrabalhado);
                      const marca = prod ? extrairMarca(prod) : '';
                      const basePrice = prod ? extrairPrecoBaseProduto(prod) : null;
                      const activePrice =
                        customPrecos[controle.id!] !== undefined
                          ? customPrecos[controle.id!]
                          : controle.precoTrabalhado !== null && controle.precoTrabalhado !== undefined
                          ? controle.precoTrabalhado
                          : basePrice;
                      const copies = customCopiesMap[controle.id!] || 1;

                      return (
                        <tr
                          key={controle.id}
                          className={`transition-colors ${
                            isChecked
                              ? 'bg-rose-50/60 dark:bg-rose-950/20'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSelectControle(controle.id!)}
                              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                            />
                          </td>

                          {/* Code */}
                          <td className="px-3 py-3 text-center font-mono font-black text-slate-900 dark:text-white">
                            {controle.codigo}-{controle.dig}
                          </td>

                          {/* Description + Brand */}
                          <td className="px-4 py-3 max-w-xs">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                              {prod?.descricao || '-'}
                            </div>
                            {marca && (
                              <span className="inline-block text-[9px] font-extrabold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.2 rounded mt-0.5">
                                {marca}
                              </span>
                            )}
                          </td>

                          {/* Packaging */}
                          <td className="px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {prod?.embalagem || '-'}
                          </td>

                          {/* Expiration Date */}
                          <td className="px-3 py-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black border ${prioColor.bgClass} ${prioColor.textClass} ${prioColor.borderClass}`}
                            >
                              {formatarDataBR(controle.dataVencimento)}
                            </span>
                          </td>

                          {/* Price (Editable inline) */}
                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <span className="text-slate-400 font-bold">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={activePrice !== null && activePrice !== undefined ? activePrice : ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setCustomPrecos((prev) => ({
                                    ...prev,
                                    [controle.id!]: isNaN(val) ? null : val,
                                  }));
                                }}
                                placeholder="0,00"
                                className="w-20 p-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-black text-rose-600 dark:text-rose-400 text-right focus:ring-2 focus:ring-rose-500"
                              />
                            </div>
                          </td>

                          {/* Copies */}
                          <td className="px-2 py-3 text-center whitespace-nowrap">
                            <input
                              type="number"
                              min="1"
                              max="50"
                              value={copies}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 1;
                                setCustomCopiesMap((prev) => ({ ...prev, [controle.id!]: Math.max(1, val) }));
                              }}
                              className="w-12 p-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-center"
                            />
                          </td>

                          {/* Status */}
                          <td className="px-3 py-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${statusCfg.bgClass} ${statusCfg.textClass} ${statusCfg.borderClass}`}
                            >
                              <span>{statusCfg.label}</span>
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  if (prod) setPreviewCartaz(criarCartazItemDeProduto(prod, controle));
                                }}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                                title="Ver Prévia do Cartaz TAGG"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleGerarPdfItemUnico(controle)}
                                className="p-1.5 text-emerald-600 hover:text-white hover:bg-emerald-600 rounded-lg"
                                title="Imprimir Cartaz Deste Produto"
                              >
                                <Printer className="w-4 h-4" />
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

            {/* Ad-hoc Posters Sublist if any exist */}
            {cartazesAvulsos.length > 0 && (
              <div className="border-t-2 border-dashed border-rose-200 dark:border-rose-900/60 p-4 bg-rose-50/30 dark:bg-rose-950/10">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black uppercase text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Cartazes Adicionados Avulsos ({cartazesAvulsos.length})</span>
                  </h4>
                  <button
                    onClick={() => setCartazesAvulsos([])}
                    className="text-[10px] font-bold text-red-600 hover:underline"
                  >
                    Remover Avulsos
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {cartazesAvulsos.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-2.5 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-mono font-bold text-[10px] text-rose-600">{item.codigo}-{item.dig}</span>
                        <p className="font-black text-slate-900 dark:text-slate-100 truncate">{item.descricao}</p>
                        <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold">
                          Venc: {formatarDataBR(item.dataVencimento)} | R$ {item.precoVenda ? item.precoVenda.toFixed(2) : '--'}
                        </span>
                      </div>
                      <button
                        onClick={() => setCartazesAvulsos((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ADICIONAR AVULSO / CATÁLOGO GERAL */}
      {activeTab === 'BUSCA_AVULSA' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-rose-600" />
              <h3 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">
                LOCALIZAR PRODUTO NO CATÁLOGO OU POR EAN
              </h3>
            </div>
            <span className="text-xs text-slate-500">{produtos.length} produtos cadastrados</span>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Digite o código (ex: 70510), código com dígito (00070510-150), EAN de barras ou nome do produto..."
              value={manualSearchTerm}
              onChange={(e) => setManualSearchTerm(e.target.value)}
              className="w-full pl-11 pr-24 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-slate-100"
            />
            <button
              onClick={handleTriggerScanner}
              className="absolute right-2.5 top-2 px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Câmera EAN</span>
            </button>

            {/* Results Dropdown */}
            {manualSearchTerm.trim().length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {manualSearchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">Nenhum produto encontrado.</div>
                ) : (
                  manualSearchResults.map((prod) => (
                    <button
                      key={prod.id}
                      onClick={() => handleSelectManualProduto(prod)}
                      className="w-full text-left p-3 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-black text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/60 px-1.5 py-0.5 rounded">
                          {prod.codigo}-{prod.dig}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 ml-2">{prod.descricao}</span>
                        <span className="text-slate-400 ml-2">({prod.embalagem})</span>
                      </div>
                      <span className="text-rose-600 font-bold">Selecionar →</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Form for selected product */}
          {selectedManualProduto && (
            <div className="p-4 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono font-black text-xs text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-900 px-2 py-0.5 rounded">
                    {selectedManualProduto.codigo}-{selectedManualProduto.dig}
                  </span>
                  <h4 className="font-black text-base text-slate-900 dark:text-slate-100 mt-1">
                    {selectedManualProduto.descricao}
                  </h4>
                </div>
                <button
                  onClick={() => setSelectedManualProduto(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Preço de Oferta (R$)
                  </label>
                  <input
                    type="text"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-black text-rose-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Data de Vencimento
                  </label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full p-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Cópias
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={manualCopies}
                    onChange={(e) => setManualCopies(parseInt(e.target.value, 10) || 1)}
                    className="w-full p-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-center"
                  />
                </div>
              </div>

              <button
                onClick={handleAddManualAoLote}
                disabled={!manualDate}
                className={`w-full py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg transition-all ${
                  manualDate
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>ADICIONAR À FILA DE IMPRESSÃO EM LOTE</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* SECTION: PREVIEW & BATCH PRINT TRIGGER (PRÉ-VISUALIZAÇÃO OFICIAL TAGG 1-4) */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-600/30 text-rose-400 rounded-xl">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-white">
                PRÉ-VISUALIZAÇÃO TAGG OFICIAL & GERAÇÃO DE PDF
              </h3>
              <p className="text-xs text-slate-400">
                {itensCartazesSelecionados.length} produtos selecionados ({totalCartazesImpressao} cópias no total)
              </p>
            </div>
          </div>

          {/* Layout Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setPdfLayout('1_POR_PAGINA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                pdfLayout === '1_POR_PAGINA' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              1 por Folha A4
            </button>
            <button
              onClick={() => setPdfLayout('2_POR_PAGINA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                pdfLayout === '2_POR_PAGINA' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              2 por Folha A4
            </button>
            <button
              onClick={() => setPdfLayout('4_POR_PAGINA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                pdfLayout === '4_POR_PAGINA' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              4 por Folha A4
            </button>
          </div>
        </div>

        {/* Poster Visual Card (Always renders: Clean Layout when no items selected, Filled when item selected) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Visual Card Simulation */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center space-y-3">
            <div className="w-full max-w-[500px]">
              <CartazTaggVisual item={previewCartaz} className="rounded-xl shadow-2xl" />
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase ${
                previewCartaz
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {previewCartaz ? '● Cartaz Preenchido (Produto Selecionado)' : '○ Layout Limpo (Aguardando Seleção)'}
              </span>
            </div>
          </div>

          {/* Print Trigger Action & Template Controls */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-[10px] font-black uppercase">
                    {hasCustomTemplate ? 'Arte Oficial Carregada (PNG/JPG)' : 'Template Gráfico Integrado'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {previewCartaz
                  ? 'As informações do produto, preço gigante e código de barras foram sobrepostos nas coordenadas oficiais.'
                  : 'Selecione produtos na tabela acima ou busque na aba avulsa para preencher o layout automaticamente.'}
              </p>

              {/* Upload & Reset custom template graphic */}
              <div className="pt-2 border-t border-slate-700 flex flex-wrap items-center gap-2">
                <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-all border border-slate-600">
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>{hasCustomTemplate ? 'Trocar Arte de Fundo (PNG)' : 'Carregar Imagem da Arte (PNG/JPG)'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleUploadTemplate}
                    className="hidden"
                  />
                </label>

                {hasCustomTemplate && (
                  <button
                    onClick={handleResetTemplate}
                    className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-lg text-xs font-bold transition-all"
                    title="Restaurar matriz gráfica embutida"
                  >
                    Restaurar Padrão
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={handleGerarPdfLote}
              disabled={itensCartazesSelecionados.length === 0}
              className={`w-full py-4 px-6 rounded-2xl text-sm font-black flex items-center justify-center gap-2.5 shadow-xl transition-all active:scale-95 border-2 ${
                itensCartazesSelecionados.length > 0
                  ? 'bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-400/40'
                  : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
              }`}
            >
              <Printer className="w-5 h-5" />
              <span>
                IMPRIMIR CARTAZES EM LOTE ({itensCartazesSelecionados.length} PRODUTOS - {totalCartazesImpressao} CÓPIAS)
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
