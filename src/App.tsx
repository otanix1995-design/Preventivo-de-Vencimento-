import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/database';
import type { Produto, ControleVencimento, StatusVencimento } from './types';
import { calcularStatusVencimento } from './utils/date';

// Components
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { TabelaProdutos } from './components/TabelaProdutos';
import { TabelaCatalogoProdutos } from './components/TabelaCatalogoProdutos';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { LinkEanModal } from './components/LinkEanModal';
import { CadastroVencimentoModal } from './components/CadastroVencimentoModal';
import { ImportExcelModal } from './components/ImportExcelModal';
import { PdfExportModal } from './components/PdfExportModal';
import { DetachedHistoryModal } from './components/DetachedHistoryModal';
import { AlertExpiredModal } from './components/AlertExpiredModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'produtos' | 'catalogo'>('dashboard');

  // Modal States
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isLinkEanOpen, setIsLinkEanOpen] = useState(false);
  const [unlinkedEan, setUnlinkedEan] = useState('');

  const [isCadastroOpen, setIsCadastroOpen] = useState(false);
  const [selectedProdutoForCadastro, setSelectedProdutoForCadastro] = useState<Produto | null>(null);
  const [selectedControleForEdit, setSelectedControleForEdit] = useState<ControleVencimento | null>(null);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isPdfOpen, setIsPdfOpen] = useState(false);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedControleForHistory, setSelectedControleForHistory] = useState<ControleVencimento | null>(null);

  // Startup Alert Modal
  const [hasDismissedAlert, setHasDismissedAlert] = useState(false);
  const [isAlertExpiredOpen, setIsAlertExpiredOpen] = useState(false);

  // Live DB Queries
  const rawProdutos = useLiveQuery(() => db.produtos.toArray(), []);
  const rawControles = useLiveQuery(() => db.controleVencimento.toArray(), []);

  const produtosList = rawProdutos || [];

  // Map products by ID for instant O(1) lookups
  const produtosMap = useMemo(() => {
    const map = new Map<string, Produto>();
    produtosList.forEach((p) => map.set(p.id, p));
    return map;
  }, [produtosList]);

  // Dynamically update status based on current date whenever loaded
  const controles = useMemo(() => {
    if (!rawControles) return [];

    return rawControles.map((c) => {
      const currentStatus = calcularStatusVencimento(c.dataVencimento);
      if (currentStatus !== c.status) {
        // Sync database status if changed due to date progression
        db.controleVencimento.update(c.id!, {
          status: currentStatus,
          atualizadoEm: new Date().toISOString(),
        });
        return { ...c, status: currentStatus };
      }
      return c;
    });
  }, [rawControles]);

  // Map expiration controls by product ID
  const controlesMap = useMemo(() => {
    const map = new Map<string, ControleVencimento[]>();
    controles.forEach((c) => {
      const list = map.get(c.produtoId) || [];
      list.push(c);
      map.set(c.produtoId, list);
    });
    return map;
  }, [controles]);

  // Check for expired items on startup
  useEffect(() => {
    if (controles.length > 0 && !hasDismissedAlert) {
      const expiredList = controles.filter((c) => c.status === 'VENCIDO');
      if (expiredList.length > 0) {
        setIsAlertExpiredOpen(true);
      }
    }
  }, [controles, hasDismissedAlert]);

  // Barcode Scanning Flow
  const handleScanSuccess = async (scannedEan: string) => {
    setIsScannerOpen(false);

    // Look up EAN in DB
    const vinculo = await db.vinculosEan.where('ean').equals(scannedEan).first();

    if (vinculo) {
      // EAN is linked to a product!
      const prod = await db.produtos.get(vinculo.produtoId);
      if (prod) {
        setSelectedProdutoForCadastro(prod);
        setSelectedControleForEdit(null);
        setIsCadastroOpen(true);
      } else {
        // Fallback search by code
        const prodByCode = await db.produtos.get(vinculo.codigo);
        if (prodByCode) {
          setSelectedProdutoForCadastro(prodByCode);
          setSelectedControleForEdit(null);
          setIsCadastroOpen(true);
        } else {
          setUnlinkedEan(scannedEan);
          setIsLinkEanOpen(true);
        }
      }
    } else {
      // EAN not linked! Prompt link modal immediately
      setUnlinkedEan(scannedEan);
      setIsLinkEanOpen(true);
    }
  };

  // EAN Linking Success
  const handleLinkSuccess = (produto: Produto, ean: string) => {
    setIsLinkEanOpen(false);
    setSelectedProdutoForCadastro(produto);
    setSelectedControleForEdit(null);
    setIsCadastroOpen(true);
  };

  // Inline Handlers
  const handleUpdatePrecoTrabalhado = async (controleId: number, novoPreco: number | null) => {
    await db.controleVencimento.update(controleId, {
      precoTrabalhado: novoPreco,
      atualizadoEm: new Date().toISOString(),
    });
  };

  const handleDeleteControle = async (id: number) => {
    if (window.confirm('Tem certeza que deseja remover este registro do controle de vencimentos?')) {
      await db.controleVencimento.delete(id);
    }
  };

  const handleEditControle = (controle: ControleVencimento) => {
    const prod = produtosMap.get(controle.produtoId) || null;
    setSelectedProdutoForCadastro(prod);
    setSelectedControleForEdit(controle);
    setIsCadastroOpen(true);
  };

  const handleViewHistory = (controle: ControleVencimento) => {
    setSelectedControleForHistory(controle);
    setIsHistoryOpen(true);
  };

  const vencidosCount = controles.filter((c) => c.status === 'VENCIDO').length;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col">
      {/* Header Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenCadastro={() => {
          setSelectedProdutoForCadastro(null);
          setSelectedControleForEdit(null);
          setIsCadastroOpen(true);
        }}
        onOpenImport={() => setIsImportOpen(true)}
        onOpenPdf={() => setIsPdfOpen(true)}
        onOpenSearchCode={() => {
          setSelectedProdutoForCadastro(null);
          setSelectedControleForEdit(null);
          setIsCadastroOpen(true);
        }}
        vencidosCount={vencidosCount}
        catalogoCount={produtosList.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {activeTab === 'dashboard' ? (
          <Dashboard
            controles={controles}
            produtosMap={produtosMap}
            onNavigateToProdutos={(filter) => {
              setActiveTab('produtos');
            }}
            onOpenCadastro={() => {
              setSelectedProdutoForCadastro(null);
              setSelectedControleForEdit(null);
              setIsCadastroOpen(true);
            }}
            onOpenImport={() => setIsImportOpen(true)}
            onOpenScanner={() => setIsScannerOpen(true)}
          />
        ) : activeTab === 'produtos' ? (
          <TabelaProdutos
            controles={controles}
            produtosMap={produtosMap}
            onEditControle={handleEditControle}
            onDeleteControle={handleDeleteControle}
            onViewHistory={handleViewHistory}
            onUpdatePrecoTrabalhado={handleUpdatePrecoTrabalhado}
          />
        ) : (
          <TabelaCatalogoProdutos
            produtos={produtosList}
            controlesMap={controlesMap}
            onCadastrarVencimento={(produto) => {
              setSelectedProdutoForCadastro(produto);
              setSelectedControleForEdit(null);
              setIsCadastroOpen(true);
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-3 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Controle Inteligente de Vencimentos &copy; {new Date().getFullYear()}</span>
          <span className="font-semibold text-slate-600 dark:text-slate-300">
            PWA Responsivo • Scanner EAN • Comparativo Excel
          </span>
        </div>
      </footer>

      {/* Modals */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />

      <LinkEanModal
        isOpen={isLinkEanOpen}
        unlinkedEan={unlinkedEan}
        onClose={() => setIsLinkEanOpen(false)}
        onLinkSuccess={handleLinkSuccess}
      />

      <CadastroVencimentoModal
        isOpen={isCadastroOpen}
        initialProduto={selectedProdutoForCadastro}
        initialControleToEdit={selectedControleForEdit}
        onClose={() => {
          setIsCadastroOpen(false);
          setSelectedProdutoForCadastro(null);
          setSelectedControleForEdit(null);
        }}
        onSuccess={() => {
          setIsCadastroOpen(false);
          setSelectedProdutoForCadastro(null);
          setSelectedControleForEdit(null);
        }}
      />

      <ImportExcelModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => setIsImportOpen(false)}
        onGoToCatalogo={() => setActiveTab('catalogo')}
      />

      <PdfExportModal
        isOpen={isPdfOpen}
        controles={controles}
        produtosMap={produtosMap}
        onClose={() => setIsPdfOpen(false)}
      />

      <DetachedHistoryModal
        isOpen={isHistoryOpen}
        controle={selectedControleForHistory}
        produto={selectedControleForHistory ? produtosMap.get(selectedControleForHistory.produtoId) || null : null}
        onClose={() => {
          setIsHistoryOpen(false);
          setSelectedControleForHistory(null);
        }}
      />

      <AlertExpiredModal
        isOpen={isAlertExpiredOpen}
        expiredItems={controles.filter((c) => c.status === 'VENCIDO')}
        produtosMap={produtosMap}
        onClose={() => {
          setIsAlertExpiredOpen(false);
          setHasDismissedAlert(true);
        }}
        onViewProducts={() => {
          setIsAlertExpiredOpen(false);
          setHasDismissedAlert(true);
          setActiveTab('produtos');
        }}
      />
    </div>
  );
}
