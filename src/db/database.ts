import Dexie, { type Table } from 'dexie';
import type {
  Produto,
  VinculoEAN,
  Importacao,
  EstoqueHistorico,
  ControleVencimento,
  HistoricoMovimentacao,
  VendaReal,
  DivergenciaVenda,
  AuditoriaFefo,
} from '../types';

export class VencimentosDatabase extends Dexie {
  produtos!: Table<Produto, string>;
  vinculosEan!: Table<VinculoEAN, number>;
  importacoes!: Table<Importacao, number>;
  estoqueHistorico!: Table<EstoqueHistorico, number>;
  controleVencimento!: Table<ControleVencimento, number>;
  historicoMovimentacao!: Table<HistoricoMovimentacao, number>;
  vendasReais!: Table<VendaReal, number>;
  divergenciasVendas!: Table<DivergenciaVenda, number>;
  auditoriaFefo!: Table<AuditoriaFefo, number>;

  constructor() {
    super('VencimentosDB');

    // Schema definition
    this.version(1).stores({
      produtos: 'id, codigo, dig, codigoOriginal, compradorFilial, tipoControle',
      vinculosEan: '++id, &ean, produtoId, codigo',
      importacoes: '++id, dataHora, criadoEm',
      estoqueHistorico: '++id, importacaoId, produtoId, codigo',
      controleVencimento: '++id, produtoId, codigo, dataVencimento, status',
      historicoMovimentacao: '++id, controleVencimentoId, importacaoId',
    });

    this.version(2).stores({
      vendasReais: '++id, &saleId, codigo, dig, dataHoraTimestamp, status, importacaoId, criadoEm',
      divergenciasVendas: '++id, saleId, codigo, status, importacaoId, criadoEm',
      auditoriaFefo: '++id, importacaoId, produtoId, codigo, dataHora, criadoEm',
    });
  }
}

export const db = new VencimentosDatabase();

