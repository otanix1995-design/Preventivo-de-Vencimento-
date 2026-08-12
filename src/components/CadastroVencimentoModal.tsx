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
import { converterParaGramas, gramasParaKgEGramas } from '../utils/quantity';
import { calcularStatusVencimento, parsePrecoString } from '../utils/date';

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
  const [existingDuplicate, setExistingDuplicate] = useState<ControleVencimento | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

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
    setExistingDuplicate(null);
    setShowDuplicateDialog(false);
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

    // Check if duplicate entry exists (unless we are explicitly editing an existing record)
    if (!initialControleToEdit) {
      const dup = await db.controleVencimento
        .where({ produtoId: produto.id, dataVencimento })
        .first();

      if (dup) {
        setExistingDuplicate(dup);
        setShowDuplicateDialog(true);
        return;
      }
    }

    await saveControleVencimento(false);
  };

  const saveControleVencimento = async (forceCreateNew = false) => {
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
      } else if (existingDuplicate && !forceCreateNew) {
        // User chose to update existing duplicate record
        await db.controleVencimento.update(existingDuplicate.id!, dataToSave);
      } else {
        // Create new record
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

      {/* Duplicate Entry Modal Dialog (Section 31) */}
      {showDuplicateDialog && existingDuplicate && (
        <div className="fixed inset-0 z-60 bg-slate-950/90 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center gap-3 text-amber-500">
              <AlertTriangle className="w-7 h-7 shrink-0" />
              <h4 className="font-black text-lg">PRODUTO DUPLICADO</h4>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300">
              Este produto já possui um registro cadastrado para a data de vencimento <strong className="text-amber-500">{dataVencimento}</strong>.
            </p>

            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl text-xs space-y-1 font-mono">
              <p>Código: {existingDuplicate.codigo}</p>
              <p>Vencimento: {existingDuplicate.dataVencimento}</p>
              <p>Quantidade Atual: {existingDuplicate.quantidadeAtual}</p>
            </div>

            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">O que deseja fazer?</p>

            <div className="space-y-2">
              <button
                onClick={async () => {
                  setShowDuplicateDialog(false);
                  await saveControleVencimento(false); // Update existing
                }}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Edit className="w-4 h-4" /> Atualizar Registro Existente
              </button>

              <button
                onClick={async () => {
                  setShowDuplicateDialog(false);
                  await saveControleVencimento(true); // Force create new
                }}
                className="w-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" /> Criar Novo Registro Mesmo Assim
              </button>

              <button
                onClick={() => setShowDuplicateDialog(false)}
                className="w-full text-slate-400 hover:text-slate-200 text-xs py-1 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
