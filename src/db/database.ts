import Dexie, { type Table } from 'dexie';
import type {
  Produto,
  VinculoEAN,
  Importacao,
  EstoqueHistorico,
  ControleVencimento,
  HistoricoMovimentacao,
} from '../types';

export class VencimentosDatabase extends Dexie {
  produtos!: Table<Produto, string>;
  vinculosEan!: Table<VinculoEAN, number>;
  importacoes!: Table<Importacao, number>;
  estoqueHistorico!: Table<EstoqueHistorico, number>;
  controleVencimento!: Table<ControleVencimento, number>;
  historicoMovimentacao!: Table<HistoricoMovimentacao, number>;

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
  }
}

export const db = new VencimentosDatabase();
