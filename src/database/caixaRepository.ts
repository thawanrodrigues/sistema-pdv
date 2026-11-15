// ============================================================
// Repository de Caixa
// ============================================================
import { getDB } from './db';

export type Movimentacao = {
  id: number;
  caixaId: number;
  tipo: 'abertura' | 'fechamento' | 'entrada' | 'saida' | 'venda';
  descricao: string;
  valor: number;
  hora: string;
};

export type CaixaDB = {
  id: number;
  status: 'aberto' | 'fechado';
  saldoAbertura: number;
  saldoFechamento: number;
  usuarioId: number;
  abertoEm: string;
  fechadoEm: string | null;
};

/** Retorna o caixa atualmente aberto, ou null */
export async function getCaixaAberto(): Promise<CaixaDB | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>(
    "SELECT * FROM caixa WHERE status = 'aberto' ORDER BY id DESC LIMIT 1"
  );
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    saldoAbertura: row.saldo_abertura,
    saldoFechamento: row.saldo_fechamento,
    usuarioId: row.usuario_id,
    abertoEm: row.aberto_em,
    fechadoEm: row.fechado_em,
  };
}

/** Abre um novo caixa */
export async function abrirCaixa(usuarioId: number, saldoAbertura = 0): Promise<number> {
  const db = await getDB();
  const result = await db.runAsync(
    `INSERT INTO caixa (status, saldo_abertura, usuario_id, aberto_em)
     VALUES ('aberto', ?, ?, datetime('now','localtime'))`,
    [saldoAbertura, usuarioId]
  );
  const caixaId = result.lastInsertRowId;
  await db.runAsync(
    `INSERT INTO movimentacoes (caixa_id, tipo, descricao, valor)
     VALUES (?, 'abertura', 'Abertura de Caixa', ?)`,
    [caixaId, saldoAbertura]
  );
  return caixaId;
}

/** Fecha o caixa aberto */
export async function fecharCaixa(caixaId: number, saldoFechamento: number): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `UPDATE caixa SET
       status = 'fechado',
       saldo_fechamento = ?,
       fechado_em = datetime('now','localtime')
     WHERE id = ?`,
    [saldoFechamento, caixaId]
  );
  await db.runAsync(
    `INSERT INTO movimentacoes (caixa_id, tipo, descricao, valor)
     VALUES (?, 'fechamento', 'Fechamento de Caixa', ?)`,
    [caixaId, saldoFechamento]
  );
}

/** Adiciona uma movimentação (entrada ou saída) */
export async function addMovimentacao(
  caixaId: number,
  tipo: 'entrada' | 'saida' | 'venda',
  descricao: string,
  valor: number
): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT INTO movimentacoes (caixa_id, tipo, descricao, valor)
     VALUES (?, ?, ?, ?)`,
    [caixaId, tipo, descricao, valor]
  );
}

/** Lista movimentações do caixa atual */
export async function getMovimentacoes(caixaId: number): Promise<Movimentacao[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM movimentacoes WHERE caixa_id = ? ORDER BY id DESC',
    [caixaId]
  );
  return rows.map((r) => ({
    id: r.id,
    caixaId: r.caixa_id,
    tipo: r.tipo,
    descricao: r.descricao,
    valor: r.valor,
    hora: r.hora,
  }));
}

/** Calcula totais do caixa atual */
export async function getTotaisCaixa(caixaId: number): Promise<{
  entradas: number;
  saidas: number;
  vendas: number;
  saldoAtual: number;
}> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>(
    `SELECT
       COALESCE(SUM(CASE WHEN tipo IN ('entrada','abertura') THEN valor ELSE 0 END), 0) as entradas,
       COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) as saidas,
       COALESCE(SUM(CASE WHEN tipo = 'venda' THEN valor ELSE 0 END), 0) as vendas
     FROM movimentacoes WHERE caixa_id = ?`,
    [caixaId]
  );

  const abertura = await db.getFirstAsync<{ saldo_abertura: number }>(
    'SELECT saldo_abertura FROM caixa WHERE id = ?',
    [caixaId]
  );

  const e = row?.entradas || 0;
  const s = row?.saidas || 0;
  const v = row?.vendas || 0;
  const ab = abertura?.saldo_abertura || 0;

  return {
    entradas: e,
    saidas: s,
    vendas: v,
    saldoAtual: ab + e + v - s,
  };
}
