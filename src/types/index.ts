export type TipoControle = 'PESO' | 'UNIDADE' | 'NAO_IDENTIFICADO';

export type StatusVencimento = 
  | 'VENCIDO'           // 🔴 Vencido
  | 'VENCE_HOJE'        // 🟠 Vence hoje
  | 'VENCE_3_DIAS'      // 🟡 Vence em até 3 dias
  | 'VENCE_7_DIAS'      // 🟡 Vence em até 7 dias
  | 'MAIS_7_DIAS';      // 🟢 Mais de 7 dias

export interface Produto {
  id: string;                 // unique ID (e.g. "70510")
  codigo: string;             // e.g. "70510" (without leading zeros)
  dig: string;                // e.g. "150"
  codigoOriginal: string;     // e.g. "00070510-150"
  descricao: string;          // DESCRIÇÃO MERCADORIA
  embalagem: string;          // EMBALAGEM
  tipoControle: TipoControle; // PESO | UNIDADE | NAO_IDENTIFICADO
  compradorFilial: string;    // COMPRADOR FILIAL
  estoqueEmb1: string;        // Raw ESTOQUE EMB1
  estoqueEmb9: string;        // Raw ESTOQUE EMB9
  outrasColunas?: Record<string, any>; // Preserves all extra Excel columns
  criadoEm: string;           // ISO timestamp
  atualizadoEm: string;       // ISO timestamp
}

export interface VinculoEAN {
  id?: number;
  ean: string;
  produtoId: string;
  codigo: string;
  dig: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Importacao {
  id?: number;
  nomeArquivo: string;
  dataHora: string;           // e.g. "11/08/2026 — 07:35"
  criadoEm: string;           // ISO string
  qtdProdutos: number;
}

export interface EstoqueHistorico {
  id?: number;
  importacaoId: number;
  produtoId: string;
  codigo: string;
  dig: string;
  estoqueEmb1: string;
  estoqueEmb9: string;
  dataHora: string;
}

export interface ControleVencimento {
  id?: number;
  produtoId: string;
  codigo: string;
  dig: string;
  quantidadeInicial: number; // In grams for PESO or integer for UNIDADE
  quantidadeAtual: number;   // In grams for PESO or integer for UNIDADE
  unidadeControle: TipoControle;
  dataVencimento: string;    // YYYY-MM-DD
  precoTrabalhado: number | null; // e.g. 14.90
  status: StatusVencimento;
  observacoes?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface HistoricoMovimentacao {
  id?: number;
  controleVencimentoId: number;
  importacaoId: number;
  dataHora: string;
  estoqueAnteriorEmb1: string;
  estoqueAnteriorEmb9: string;
  estoqueAtualEmb1: string;
  estoqueAtualEmb9: string;
  movimentacaoIdentificada: number; // grams or units
  quantidadeAnterior: number;
  quantidadeNova: number;
}

export interface FiltroPdfOptions {
  status: 'TODOS' | StatusVencimento | 'PERIODO';
  dataInicio?: string;
  dataFim?: string;
  compradorFilial: string; // 'TODOS' or specific compradorFilial
  ordenacao: 'DATA_VENCIMENTO' | 'CODIGO' | 'DESCRICAO' | 'COMPRADOR' | 'PRIORIDADE';
}
