import React, { useState } from 'react';
import { db } from '../db/database';
import type { Produto } from '../types';
import { Link2, Search, CheckCircle2, AlertTriangle, X } from 'lucide-react';

interface LinkEanModalProps {
  isOpen: boolean;
  unlinkedEan: string;
  onClose: () => void;
  onLinkSuccess: (produto: Produto, ean: string) => void;
}

export const LinkEanModal: React.FC<LinkEanModalProps> = ({
  isOpen,
  unlinkedEan,
  onClose,
  onLinkSuccess,
}) => {
  const [searchCodigo, setSearchCodigo] = useState('');
  const [foundProduto, setFoundProduto] = useState<Produto | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSearchCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    setFoundProduto(null);

    const cleanCode = searchCodigo.trim().replace(/^0+/, '');
    if (!cleanCode) {
      setSearchError('Digite o código do produto para localizar.');
      return;
    }

    // Search by product code in database
    const prod = await db.produtos.get(cleanCode);
    if (!prod) {
      // Try searching by original code if not found directly
      const byOriginal = await db.produtos
        .where('codigoOriginal')
        .equals(searchCodigo.trim())
        .first();

      if (byOriginal) {
        setFoundProduto(byOriginal);
      } else {
        setSearchError(`Não encontramos o código ${cleanCode} na base atual de produtos.`);
      }
    } else {
      setFoundProduto(prod);
    }
  };

  const handleConfirmLink = async () => {
    if (!foundProduto || !unlinkedEan) return;
    setIsSaving(true);

    try {
      const nowIso = new Date().toISOString();

      // Check if this EAN is already linked to avoid constraint duplicate error
      const existingLink = await db.vinculosEan.where('ean').equals(unlinkedEan).first();
      if (existingLink) {
        await db.vinculosEan.update(existingLink.id!, {
          produtoId: foundProduto.id,
          codigo: foundProduto.codigo,
          dig: foundProduto.dig,
          atualizadoEm: nowIso,
        });
      } else {
        await db.vinculosEan.add({
          ean: unlinkedEan,
          produtoId: foundProduto.id,
          codigo: foundProduto.codigo,
          dig: foundProduto.dig,
          criadoEm: nowIso,
          atualizadoEm: nowIso,
        });
      }

      setIsSaving(false);
      onLinkSuccess(foundProduto, unlinkedEan);
    } catch (err) {
      console.error('Erro ao salvar vínculo EAN:', err);
      setIsSaving(false);
      setSearchError('Erro ao registrar vínculo de EAN no banco de dados.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-900 dark:text-white">
        {/* Header */}
        <div className="px-5 py-4 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <div>
              <h3 className="font-bold text-base text-amber-950 dark:text-amber-200">EAN NÃO VINCULADO</h3>
              <p className="text-xs text-amber-800 dark:text-amber-400 font-mono">EAN: {unlinkedEan}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Este código de barras ainda não possui vínculo com nenhum produto na base. Informe o código do produto para criar o vínculo permanente.
          </p>

          {/* Search Code Form */}
          <form onSubmit={handleSearchCode} className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Vincular ao CÓDIGO do Produto:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: 21978 ou 70510"
                value={searchCodigo}
                onChange={(e) => setSearchCodigo(e.target.value)}
                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm font-mono focus:outline-none focus:border-amber-500"
                autoFocus
              />
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow active:scale-95"
              >
                <Search className="w-4 h-4" /> Buscar
              </button>
            </div>
          </form>

          {/* Error message */}
          {searchError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {/* Product Details Confirmation Card */}
          {foundProduto && (
            <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-xs font-mono font-black text-amber-600 dark:text-amber-400">
                  CÓDIGO: {foundProduto.codigo} | DIG: {foundProduto.dig}
                </span>
                <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded">
                  {foundProduto.tipoControle}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Descrição</span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {foundProduto.descricao}
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Embalagem</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{foundProduto.embalagem || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Comprador Filial</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{foundProduto.compradorFilial || '-'}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> CONFIRMAR VÍNCULO?
                </p>
                <button
                  onClick={handleConfirmLink}
                  disabled={isSaving}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow active:scale-95 flex items-center justify-center gap-2"
                >
                  <Link2 className="w-4 h-4" />
                  <span>{isSaving ? 'Salvando Vínculo...' : 'CONFIRMAR VÍNCULO'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-300 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
