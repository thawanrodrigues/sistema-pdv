// ============================================================
// Repository de Vendas
// ============================================================
import { getDB } from './db';
import { descontarEstoque } from './produtoRepository';

export type ItemVenda = {
  produtoId: number;
  nome: string;
  qtd: number;
  precoUnit: number;
};

export type Venda = {
  id: number;
  usuarioId: number;
  total: number;
  metodoPagamento: string;
  status: string;
  criadoEm: string;
  itens?: ItemVenda[];
};

/** Registra uma venda completa com seus itens e desconta o estoque */
export async function registrarVenda(params: {
  usuarioId: number;
  total: number;
  metodoPagamento: string;
  itens: ItemVenda[];
}): Promise<number> {
  const db = await getDB();

  const result = await db.runAsync(
    `INSERT INTO vendas (usuario_id, total, metodo_pagamento, status)
     VALUES (?, ?, ?, 'concluida')`,
    [params.usuarioId, params.total, params.metodoPagamento]
  );
  const vendaId = result.lastInsertRowId;

  for (const item of params.itens) {
    await db.runAsync(
      `INSERT INTO itens_venda (venda_id, produto_id, nome, qtd, preco_unit)
       VALUES (?, ?, ?, ?, ?)`,
      [vendaId, item.produtoId, item.nome, item.qtd, item.precoUnit]
    );
    // Descontar estoque se for produto do catálogo
    if (item.produtoId > 0) {
      await descontarEstoque(item.produtoId, item.qtd);
    }
  }

  return vendaId;
}

/** Lista vendas com paginação (mais recentes primeiro) */
export async function listarVendas(limite = 50): Promise<Venda[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT v.*, u.nome as operador
     FROM vendas v
     LEFT JOIN usuarios u ON u.id = v.usuario_id
     ORDER BY v.id DESC LIMIT ?`,
    [limite]
  );
  return rows.map((r) => ({
    id: r.id,
    usuarioId: r.usuario_id,
    total: r.total,
    metodoPagamento: r.metodo_pagamento,
    status: r.status,
    criadoEm: r.criado_em,
  }));
}

/** Totais do dia atual por método de pagamento */
export async function totaisDia(): Promise<{
  total: number;
  dinheiro: number;
  cartao: number;
  pix: number;
  qtdVendas: number;
}> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>(
    `SELECT
       COUNT(*) as qtd,
       COALESCE(SUM(total), 0) as total,
       COALESCE(SUM(CASE WHEN metodo_pagamento = 'Dinheiro' THEN total ELSE 0 END), 0) as dinheiro,
       COALESCE(SUM(CASE WHEN metodo_pagamento = 'Cartão' THEN total ELSE 0 END), 0) as cartao,
       COALESCE(SUM(CASE WHEN metodo_pagamento = 'Pix' THEN total ELSE 0 END), 0) as pix
     FROM vendas
     WHERE DATE(criado_em) = DATE('now','localtime')
       AND status = 'concluida'`
  );
  return {
    total: row?.total || 0,
    dinheiro: row?.dinheiro || 0,
    cartao: row?.cartao || 0,
    pix: row?.pix || 0,
    qtdVendas: row?.qtd || 0,
  };
}
