import React from 'react';
import {
  Camera,
  Search,
  PlusCircle,
  PackageCheck,
  LayoutDashboard,
  FileSpreadsheet,
  Printer,
  Calendar,
  Database,
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'dashboard' | 'produtos' | 'catalogo';
  setActiveTab: (tab: 'dashboard' | 'produtos' | 'catalogo') => void;
  onOpenScanner: () => void;
  onOpenCadastro: () => void;
  onOpenImport: () => void;
  onOpenPdf: () => void;
  onOpenSearchCode: () => void;
  vencidosCount: number;
  catalogoCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenScanner,
  onOpenCadastro,
  onOpenImport,
  onOpenPdf,
  onOpenSearchCode,
  vencidosCount,
  catalogoCount,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md border-b border-slate-800">
      {/* Top Title Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 text-slate-950 p-2.5 rounded-xl shadow-inner font-black text-xl flex items-center justify-center">
            <Calendar className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              Controle de Vencimentos
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Gestão Inteligente de Estoque e Vencimentos
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button
            id="btn-tab-dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'dashboard'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <button
            id="btn-tab-produtos"
            onClick={() => setActiveTab('produtos')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'produtos'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            <span>Vencimentos</span>
            {vencidosCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                {vencidosCount}
              </span>
            )}
          </button>
          <button
            id="btn-tab-catalogo"
            onClick={() => setActiveTab('catalogo')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'catalogo'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Catálogo Excel</span>
            {catalogoCount > 0 && (
              <span className="bg-emerald-500 text-slate-950 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                {catalogoCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Quick Action Navigation Buttons Grid (Mobile & Desktop) */}
      <div className="bg-slate-800/90 border-t border-slate-700/80 px-3 py-2 overflow-x-auto scrollbar-none">
        <div className="max-w-7xl mx-auto flex items-center gap-2 min-w-max justify-start sm:justify-center">
          <button
            id="btn-quick-scan"
            onClick={onOpenScanner}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow transition-all active:scale-95"
          >
            <Camera className="w-4 h-4" />
            <span>ESCANEAR EAN</span>
          </button>

          <button
            id="btn-quick-search-code"
            onClick={onOpenSearchCode}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow transition-all active:scale-95"
          >
            <Search className="w-4 h-4" />
            <span>DIGITAR CÓDIGO</span>
          </button>

          <button
            id="btn-quick-cadastro"
            onClick={onOpenCadastro}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow transition-all active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>CADASTRAR VENCIMENTO</span>
          </button>

          <button
            id="btn-quick-import"
            onClick={onOpenImport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-xs font-semibold border border-slate-600 transition-all active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>IMPORTAR EXCEL</span>
          </button>

          <button
            id="btn-quick-pdf"
            onClick={onOpenPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-xs font-semibold border border-slate-600 transition-all active:scale-95"
          >
            <Printer className="w-4 h-4 text-sky-400" />
            <span>GERAR PDF</span>
          </button>
        </div>
      </div>
    </header>
  );
};
