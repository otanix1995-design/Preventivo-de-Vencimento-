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
  unidadesPorCaixa?: number;  // Extracted units per box
  tipoControle: TipoControle; // PESO | UNIDADE | NAO_IDENTIFICADO
  compradorFilial: string;    // COMPRADOR FILIAL
  estoqueEmb1: string;        // Raw ESTOQUE EMB1
  estoqueEmb9: string;        // Raw ESTOQUE EMB9
  venda30Dias?: string;       // Raw "Quantidade de Venda 30 Dias" from Excel
  venda30DiasNum?: number;    // Parsed numeric value (grams for PESO, units for UNIDADE)
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
  codigoOriginal?: string;
  descricao?: string;
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
  venda30Dias?: string;
  venda30DiasNum?: number;
  dataHora: string;
}

export interface ControleVencimento {
  id?: number;
  produtoId: string;
  codigo: string;
  dig: string;
  quantidadeInicial: number; // In grams for PESO or total integer units for UNIDADE
  quantidadeAtual: number;   // In grams for PESO or total integer units for UNIDADE
  qtdEmb1?: number;           // Quantity in EMB1 (e.g. Boxes or whole Kg)
  qtdEmb9?: number;           // Quantity in EMB9 (e.g. Loose units or grams)
  unidadesPorCaixa?: number;  // Extracted units per box (e.g. 20 from CXA 1 X 20 X 170G)
  unidadeControle: TipoControle;
  dataVencimento: string;    // YYYY-MM-DD
  precoTrabalhado: number | null; // e.g. 14.90
  status: StatusVencimento;
  observacoes?: string;
  venda30DiasReferencia?: number; // 30-day sales reference number when registered or last processed
  venda30DiasStr?: string;        // Formatted/raw 30-day sales value string
  alertaDivergencia?: boolean;    // ⚠️ True if 30-day sales decreased or cannot safely determine movement
  motivoDivergencia?: string;     // Text explanation of divergence
  alertaMovimentacaoSuperior?: boolean; // ⚠️ Warning when identified sales > controlled quantity
  movimentacaoExcedente?: number;       // Excess movement amount
  ultimaVendaIdentificada?: number;     // Identified sales amount from last import
  dataUltimaMovimentacao?: string;      // Timestamp of last movement
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
  venda30DiasAnterior?: string | number;
  venda30DiasAtual?: string | number;
  vendaIdentificada: number; // Identified sales in grams or units (positive or 0)
  movimentacaoIdentificada?: number; // Backwards compatible alias
  quantidadeAnterior: number;
  quantidadeNova: number;
  alertaDivergencia?: boolean;
  motivoDivergencia?: string;
  alertaMovimentacaoSuperior?: boolean;
  movimentacaoExcedente?: number;
}

export interface CartazItem {
  id: string;
  produtoId: string;
  codigo: string;
  dig: string;
  descricao: string;
  marca?: string;
  embalagem: string;
  unidadesPorCaixa?: number;
  tipoControle: TipoControle;
  precoVenda?: number | null;
  precoCaixa?: number | null;
  precoKg?: number | null;
  infoTributaria?: string;
  dataVencimento: string; // YYYY-MM-DD (Obrigatório)
  compradorFilial?: string;
  ean?: string;
  quantidadeCartazes: number;
  notas?: string;
}

export type LayoutCartazPdf = '1_POR_PAGINA' | '2_POR_PAGINA' | '4_POR_PAGINA';

export interface OpcoesPdfCartaz {
  layout: LayoutCartazPdf;
  tituloCabecalho?: string;
  destacarVencimento?: boolean;
}

export interface FiltroPdfOptions {
  status: 'TODOS' | StatusVencimento | 'PERIODO';
  dataInicio?: string;
  dataFim?: string;
  compradorFilial: string; // 'TODOS' or specific compradorFilial
  ordenacao: 'DATA_VENCIMENTO' | 'CODIGO' | 'DESCRICAO' | 'COMPRADOR' | 'PRIORIDADE';
  tituloRelatorio?: string;  // e.g. "PREVENTIVO SETOR FRIOS"
  liderResponsavel?: string; // e.g. "LIDER JOAO"
  dataCabecalho?: string;    // e.g. "13/08/2026"
}

export type StatusVendaReal =
  | 'PROCESSADA'
  | 'JA_PROCESSADA'
  | 'PRODUTO_NAO_ENCONTRADO'
  | 'DIG_NAO_RECONHECIDO'
  | 'EMBALAGEM_NAO_INTERPRETADA'
  | 'DIVERGENCIA'
  | 'VENDA_EXCEDENTE'
  | 'SEM_VENCIMENTO_ATIVO'
  | 'AGUARDANDO_REVISAO';

export interface VendaReal {
  id?: number;
  saleId: string;
  cnpjAtacadao?: string;
  cnpjCliente?: string;
  pdv: string;
  cupom: string;
  seq: string;
  operador?: string;
  dataVenda: string;         // e.g. "14/08/2026"
  hora?: string;              // e.g. "15:12"
  horaVenda?: string;         // alias
  dataHoraTimestamp: number; // Unix timestamp in ms
  dataHoraStr?: string;       // e.g. "14/08/2026 15:12"
  codigoOriginal: string;    // e.g. "00084906-980"
  codigo: string;            // e.g. "84906" (raiz)
  dig: string;               // e.g. "980"
  descricao: string;
  embalagem: string;
  tipoControle: TipoControle;
  leitura?: string;
  trib?: string;
  sta?: string;              // Preserved as is (e.g. "FL", "")
  qtdOriginal: number;       // Raw QTD from row
  qtdNormalizada: number;    // Normalized quantity
  unidadeNormalizada: string;// e.g. "unidades" | "gramas" | "indefinido"
  vlrUnit?: number;
  valor?: number;
  prAtual?: number;
  importacaoId: number;
  arquivoNome?: string;
  status: StatusVendaReal;
  motivoDivergencia?: string;
  qtdAplicadaVencimento?: number;
  qtdExcedente?: number;
  controlesAfetados?: number[] | {
    controleId: number;
    dataVencimento: string;
    qtdDescontada: number;
    qtdAntes: number;
    qtdDepois: number;
  }[];
  criadoEm: string;
}

export interface DivergenciaVenda {
  id?: number;
  saleId: string;
  importacaoId: number;
  codigoOriginal: string;
  codigo: string;
  dig: string;
  descricao: string;
  embalagem: string;
  dataHoraVenda?: string;
  dataVenda?: string;
  horaVenda?: string;
  pdv?: string;
  cupom?: string;
  seq?: string;
  qtd?: number;
  qtdOriginal?: number;
  qtdNormalizada?: number;
  motivo: string;
  status: StatusVendaReal;
  resolvido?: boolean;
  criadoEm: string;
}

export interface AuditoriaFefo {
  id?: number;
  importacaoId: number;
  dataHora: string;
  produtoId: string;
  codigo: string;
  dig: string;
  descricao: string;
  tipoControle: TipoControle;
  vendaTotalAplicada: number;
  vendaExcedente: number;
  saleIds: string[];
  detalhesVencimentos: {
    controleId: number;
    dataVencimento: string;
    qtdAntes: number;
    qtdDescontada: number;
    qtdDepois: number;
    descontoAplicado?: number;
  }[];
  criadoEm: string;
}

export interface ResumoImportacaoVendas {
  sucesso?: boolean;
  mensagem?: string;
  arquivoNome?: string;
  nomeArquivo?: string;
  dataHoraImportacao?: string;
  importacaoId?: number;
  totalEncontrados?: number;
  totalRegistrosEncontrados: number;
  novos: number;
  totalNovos?: number;
  jaProcessados: number;
  totalJaProcessados?: number;
  produtosNaoEncontrados: number;
  totalProdutosNaoEncontrados?: number;
  embalagensNaoInterpretadas: number;
  totalEmbalagensNaoInterpretadas?: number;
  digsNaoReconhecidos?: number;
  divergencias: number;
  totalDivergencias?: number;
  vendasAplicadasAoControle: number;
  totalVendasAplicadasControle?: number;
  vendasSemVencimentoAtivo?: number;
  totalVendasSemVencimentoAtivo?: number;
  vendasExcedentes: number;
  totalExcedentes?: number;
}
