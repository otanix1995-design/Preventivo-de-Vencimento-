import React, { useState, useEffect } from 'react';
import { db } from '../db/database';
import type { Produto, TipoControle, ControleVencimento } from '../types';
import {
  Search,
  Calendar,
  AlertTriangle,
  X,
  CheckCircle,
  Package,
  Layers,
  DollarSign,
  Edit,
  Plus,
} from 'lucide-react';
import { converterParaGramas, gramasParaKgEGramas, formatarQuantidade } from '../utils/quantity';
import { calcularStatusVencimento, parsePrecoString, formatarDataBR } from '../utils/date';

interface CadastroVencimentoModalProps {
  isOpen: boolean;
  initialProduto?: Produto | null;
  initialControleToEdit?: ControleVencimento | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const CadastroVencimentoModal: React.FC<CadastroVencimentoModalProps> = ({
  isOpen,
  initialProduto,
  initialControleToEdit,
  onClose,
  onSuccess,
}) => {
  const [searchCode, setSearchCode] = useState('');
  const [produto, setProduto] = useState<Produto | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Form Fields
  const [dataVencimento, setDataVencimento] = useState('');
  const [quilos, setQuilos] = useState<string>('0');
  const [gramas, setGramas] = useState<string>('0');
  const [qtdEmb1, setQtdEmb1] = useState<string>('0');
  const [qtdEmb9, setQtdEmb9] = useState<string>('0');
  const [precoTrabalhadoStr, setPrecoTrabalhadoStr] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Duplicity Modal state
  const [sameDateDuplicate, setSameDateDuplicate] = useState<ControleVencimento | null>(null);
  const [showSameDateDialog, setShowSameDateDialog] = useState(false);

  const [existingDifferentControls, setExistingDifferentControls] = useState<ControleVencimento[]>([]);
  const [showDifferentDateDialog, setShowDifferentDateDialog] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
      return;
    }

    if (initialControleToEdit) {
      // Editing existing control item
      loadExistingControlForEdit(initialControleToEdit);
    } else if (initialProduto) {
      // Pre-selected product
      setProduto(initialProduto);
      setSearchCode(initialProduto.codigo);
    }
  }, [isOpen, initialProduto, initialControleToEdit]);

  const resetForm = () => {
    setSearchCode('');
    setProduto(null);
    setSearchError(null);
    setDataVencimento('');
    setQuilos('0');
    setGramas('0');
    setQtdEmb1('0');
    setQtdEmb9('0');
    setPrecoTrabalhadoStr('');
    setObservacoes('');
    setSameDateDuplicate(null);
    setShowSameDateDialog(false);
    setExistingDifferentControls([]);
    setShowDifferentDateDialog(false);
    setIsSaving(false);
  };

  const loadExistingControlForEdit = async (controle: ControleVencimento) => {
    const prod = await db.produtos.get(controle.produtoId);
    if (prod) {
      setProduto(prod);
      setSearchCode(prod.codigo);
    }

    setDataVencimento(controle.dataVencimento);
    if (controle.precoTrabalhado !== null && controle.precoTrabalhado !== undefined) {
      setPrecoTrabalhadoStr(String(controle.precoTrabalhado).replace('.', ','));
    }

    if (controle.unidadeControle === 'PESO') {
      const { kg, g } = gramasParaKgEGramas(controle.quantidadeAtual);
      setQuilos(String(kg));
      setGramas(String(g));
      setQtdEmb1(controle.qtdEmb1 !== undefined ? String(controle.qtdEmb1) : '0');
      setQtdEmb9(controle.qtdEmb9 !== undefined ? String(controle.qtdEmb9) : '0');
    } else {
      setQtdEmb1(controle.qtdEmb1 !== undefined ? String(controle.qtdEmb1) : String(controle.quantidadeAtual));
      setQtdEmb9(controle.qtdEmb9 !== undefined ? String(controle.qtdEmb9) : '0');
    }
  };

  const handleSearchProduct = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchError(null);
    setProduto(null);

    const cleanCode = searchCode.trim().replace(/^0+/, '');
    if (!cleanCode) {
      setSearchError('Informe o código do produto.');
      return;
    }

    const prod = await db.produtos.get(cleanCode);
    if (!prod) {
      // Try by original code
      const prodOriginal = await db.produtos
        .where('codigoOriginal')
        .equals(searchCode.trim())
        .first();

      if (prodOriginal) {
        setProduto(prodOriginal);
      } else {
        setSearchError('Não encontramos este código na base atual.');
      }
    } else {
      setProduto(prod);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!produto) {
      setSearchError('Selecione ou busque um produto válido.');
      return;
    }

    if (!dataVencimento) {
      setSearchError('Por favor, informe a data de vencimento.');
      return;
    }

    // Check all existing expiration controls for this product
    const existingControls = await db.controleVencimento
      .where({ produtoId: produto.id })
      .toArray();

    // If editing, filter out the record currently being edited
    const otherControls = initialControleToEdit
      ? existingControls.filter((c) => c.id !== initialControleToEdit.id)
      : existingControls;

    // 1. Check for EXACT DUPLICATE (Same Code + Same DIG + Same Expiration Date)
    const exactMatch = otherControls.find((c) => c.dataVencimento === dataVencimento);

    if (exactMatch) {
      setSameDateDuplicate(exactMatch);
      setShowSameDateDialog(true);
      return;
    }

    // 2. Check for SAME PRODUCT WITH DIFFERENT EXPIRATION DATES
    if (otherControls.length > 0 && !initialControleToEdit) {
      setExistingDifferentControls(otherControls);
      setShowDifferentDateDialog(true);
      return;
    }

    // 3. Different Code or no conflicts -> proceed to save
    await saveControleVencimento();
  };

  const saveControleVencimento = async () => {
    if (!produto) return;
    setIsSaving(true);

    try {
      const nowIso = new Date().toISOString();
      const tipoControle: TipoControle =
        produto.tipoControle === 'NAO_IDENTIFICADO' ? 'UNIDADE' : produto.tipoControle;

      let qtdCalculada = 0;
      const e1 = parseInt(qtdEmb1, 10) || 0;
      const e9 = parseInt(qtdEmb9, 10) || 0;

      if (tipoControle === 'PESO') {
        const kgNum = parseFloat(quilos.replace(',', '.')) || 0;
        const gNum = parseInt(gramas, 10) || 0;
        qtdCalculada = converterParaGramas(kgNum, gNum);
      } else {
        qtdCalculada = e1 + e9;
      }

      const precoNum = parsePrecoString(precoTrabalhadoStr);
      const status = calcularStatusVencimento(dataVencimento);

      const dataToSave = {
        quantidadeAtual: qtdCalculada,
        quantidadeInicial: qtdCalculada,
        qtdEmb1: e1,
        qtdEmb9: e9,
        unidadeControle: tipoControle,
        dataVencimento,
        precoTrabalhado: precoNum,
        status,
        observacoes,
        atualizadoEm: nowIso,
      };

      if (initialControleToEdit) {
        // Update existing record
        await db.controleVencimento.update(initialControleToEdit.id!, dataToSave);
      } else {
        // Create new independent record
        await db.controleVencimento.add({
          produtoId: produto.id,
          codigo: produto.codigo,
          dig: produto.dig,
          ...dataToSave,
          criadoEm: nowIso,
        });
      }

      setIsSaving(false);
      onSuccess();
    } catch (err) {
      console.error('Erro ao salvar controle de vencimento:', err);
      setIsSaving(false);
      setSearchError('Erro ao registrar controle de vencimento no banco.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl text-slate-900 dark:text-white my-8">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base">
              {initialControleToEdit ? 'Editar Produto em Controle' : 'PRODUTOS PRÓXIMOS DO VENCIMENTO'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Step 1: Search Product by Code */}
          {!initialControleToEdit && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                DIGITAR CÓDIGO
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Digite o código (Ex: 70510 ou 21978)"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchProduct(e)}
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => handleSearchProduct()}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow active:scale-95"
                >
                  <Search className="w-4 h-4" /> Localizar
                </button>
              </div>
            </div>
          )}

          {searchError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {/* Product Info Card */}
          {produto && (
            <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-black bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-800">
                    CÓDIGO: {produto.codigo}
                  </span>
                  <span className="text-xs font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg">
                    DIG: {produto.dig}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Tipo de Controle</span>
                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                    {produto.tipoControle === 'PESO' ? '⚖️ PESO (Kg/g)' : '📦 UNIDADE'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Descrição Mercadoria</span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{produto.descricao}</h4>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Embalagem</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{produto.embalagem || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Comprador Filial</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{produto.compradorFilial || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Estoque EMB1</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{produto.estoqueEmb1 || '0'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Estoque EMB9</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{produto.estoqueEmb9 || '0'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Form Fields for Expiration Registration */}
          {produto && (
            <form onSubmit={handleFormSubmit} className="space-y-4 pt-2">
              {/* Expiration Date */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  DATA DE VENCIMENTO *
                </label>
                <input
                  type="date"
                  required
                  value={dataVencimento}
                  onChange={(e) => setDataVencimento(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Quantity based on Control Type */}
              {produto.tipoControle === 'PESO' ? (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    QUANTIDADE PRÓXIMA DO VENCIMENTO (PESO) *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5">QUILOS (Kg)</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Ex: 130"
                        value={quilos}
                        onChange={(e) => setQuilos(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm font-mono font-bold focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5">GRAMAS (g)</span>
                      <input
                        type="number"
                        min="0"
                        max="999"
                        step="1"
                        placeholder="Ex: 500"
                        value={gramas}
                        onChange={(e) => setGramas(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm font-mono font-bold focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
                    Visualização: {quilos || 0} kg {gramas || 0} g
                  </p>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    QUANTIDADES PRÓXIMAS DO VENCIMENTO (EMB1 / EMB9) *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                        QUANTIDADE EMB1 (CXA/UN)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Ex: 4"
                        value={qtdEmb1}
                        onChange={(e) => setQtdEmb1(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm font-mono font-bold focus:outline-none focus:border-amber-500"
                      />
                      {produto?.estoqueEmb1 && (
                        <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                          Estoque total EMB1: {produto.estoqueEmb1}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                        QUANTIDADE EMB9 (CXA/UN)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Ex: 4"
                        value={qtdEmb9}
                        onChange={(e) => setQtdEmb9(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm font-mono font-bold focus:outline-none focus:border-amber-500"
                      />
                      {produto?.estoqueEmb9 && (
                        <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                          Estoque total EMB9: {produto.estoqueEmb9}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-2">
                    Total em Vencimento: {(parseInt(qtdEmb1, 10) || 0) + (parseInt(qtdEmb9, 10) || 0)} caixas/unidades
                  </p>
                </div>
              )}

              {/* Preço Trabalhado */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  PREÇO TRABALHADO (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="text"
                    placeholder="Ex: 14,90"
                    value={precoTrabalhadoStr}
                    onChange={(e) => setPrecoTrabalhadoStr(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-sm font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  O preço trabalhado pertence ao controle de vencimento e não é alterado na importação de novas planilhas.
                </p>
              </div>

              {/* Submit Button */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl text-sm transition-colors shadow active:scale-95 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>{isSaving ? 'Salvando...' : 'SALVAR CADASTRO DE VENCIMENTO'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* 1. EXACT DUPLICATE DIALOG (Same Code + Same DIG + Same Expiration Date) */}
      {showSameDateDialog && sameDateDuplicate && produto && (
        <div className="fixed inset-0 z-60 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center gap-2.5 text-red-600 dark:text-red-500">
              <span className="text-2xl leading-none">🔴</span>
              <h4 className="font-black text-base leading-tight">
                PRODUTO JÁ CADASTRADO PARA ESTA DATA
              </h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Este produto já possui um cadastro de vencimento para esta mesma data.
            </p>

            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <div className="flex items-center gap-2 font-mono text-[11px] font-bold">
                <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800">
                  CÓDIGO: {produto.codigo}
                </span>
                <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded">
                  DIG: {produto.dig}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Descrição Mercadoria</span>
                <p className="font-bold text-slate-900 dark:text-white text-sm">
                  {produto.descricao}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Vencimento Cadastrado</span>
                <p className="text-red-600 dark:text-red-400 font-black text-sm">
                  {formatarDataBR(dataVencimento)}
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowSameDateDialog(false);
                  if (sameDateDuplicate) {
                    loadExistingControlForEdit(sameDateDuplicate);
                  }
                }}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow active:scale-95 uppercase tracking-wide"
              >
                <Edit className="w-4 h-4" /> VER CADASTRO EXISTENTE
              </button>

              <button
                type="button"
                onClick={() => setShowSameDateDialog(false)}
                className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-colors uppercase"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. WARNING DIALOG FOR SAME PRODUCT WITH DIFFERENT EXPIRATION DATES */}
      {showDifferentDateDialog && produto && (
        <div className="fixed inset-0 z-60 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center gap-2.5 text-amber-500">
              <AlertTriangle className="w-6 h-6 shrink-0 text-amber-500" />
              <h4 className="font-black text-base leading-tight">
                PRODUTO JÁ CADASTRADO NA LISTA DE VENCIMENTOS
              </h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Este produto já possui outro cadastro de vencimento na lista.
            </p>

            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-2.5">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Produto</span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {produto.descricao}
                </p>
                <div className="flex gap-2 font-mono text-[11px] font-bold text-slate-500 mt-0.5">
                  <span>Código: {produto.codigo}</span>
                  <span>•</span>
                  <span>DIG: {produto.dig}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
                  Vencimento(s) já cadastrado(s):
                </span>
                <ul className="space-y-1 font-mono font-bold text-amber-600 dark:text-amber-400">
                  {existingDifferentControls.map((c) => (
                    <li key={c.id} className="flex items-center gap-1.5">
                      <span>•</span>
                      <span>{formatarDataBR(c.dataVencimento)}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({formatarQuantidade(c.quantidadeAtual, c.unidadeControle)})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 font-bold text-emerald-600 dark:text-emerald-400">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Nova Data a Cadastrar</span>
                <span>• {formatarDataBR(dataVencimento)}</span>
              </div>
            </div>

            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-amber-50 dark:bg-amber-950/50 p-3 rounded-xl border border-amber-200 dark:border-amber-900/60">
              "Você está cadastrando uma nova data de vencimento para este produto. Deseja continuar?"
            </p>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={async () => {
                  setShowDifferentDateDialog(false);
                  await saveControleVencimento();
                }}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow active:scale-95 uppercase tracking-wide"
              >
                <Plus className="w-4 h-4" /> CONTINUAR CADASTRO
              </button>

              <button
                type="button"
                onClick={() => setShowDifferentDateDialog(false)}
                className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-colors uppercase"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
