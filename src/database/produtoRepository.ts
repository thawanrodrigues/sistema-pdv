// ============================================================
// Repository de Produtos
// ============================================================
import { getDB } from './db';

export type ProdutoDB = {
  id: number;
  codigo: string;
  nome: string;
  precoVenda: number;
  precoCusto: number;
  unidade: string;
  estoque: number;
  categoria: string;
  observacoes: string;
  ativo: number;
  criadoEm: string;
};

function mapRow(r: any): ProdutoDB {
  return {
    id: r.id,
    codigo: r.codigo || '',
    nome: r.nome,
    precoVenda: r.preco_venda,
    precoCusto: r.preco_custo || 0,
    unidade: r.unidade || 'UN',
    estoque: r.estoque || 0,
    categoria: r.categoria || 'Geral',
    observacoes: r.observacoes || '',
    ativo: r.ativo,
    criadoEm: r.criado_em,
  };
}

export async function listarProdutos(): Promise<ProdutoDB[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM produtos WHERE ativo = 1 ORDER BY nome'
  );
  return rows.map(mapRow);
}

export async function buscarProdutoPorCodigo(codigo: string): Promise<ProdutoDB | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM produtos WHERE codigo = ? AND ativo = 1',
    [codigo]
  );
  return row ? mapRow(row) : null;
}

export async function criarProduto(p: Omit<ProdutoDB, 'id' | 'ativo' | 'criadoEm'>): Promise<number> {
  const db = await getDB();
  const result = await db.runAsync(
    `INSERT INTO produtos (codigo, nome, preco_venda, preco_custo, unidade, estoque, categoria, observacoes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.codigo, p.nome, p.precoVenda, p.precoCusto, p.unidade, p.estoque, p.categoria, p.observacoes]
  );
  return result.lastInsertRowId;
}

export async function atualizarProduto(id: number, p: Partial<Omit<ProdutoDB, 'id' | 'criadoEm'>>): Promise<void> {
  const db = await getDB();
  const campos: string[] = [];
  const valores: any[] = [];

  if (p.codigo !== undefined) { campos.push('codigo = ?'); valores.push(p.codigo); }
  if (p.nome !== undefined) { campos.push('nome = ?'); valores.push(p.nome); }
  if (p.precoVenda !== undefined) { campos.push('preco_venda = ?'); valores.push(p.precoVenda); }
  if (p.precoCusto !== undefined) { campos.push('preco_custo = ?'); valores.push(p.precoCusto); }
  if (p.unidade !== undefined) { campos.push('unidade = ?'); valores.push(p.unidade); }
  if (p.estoque !== undefined) { campos.push('estoque = ?'); valores.push(p.estoque); }
  if (p.categoria !== undefined) { campos.push('categoria = ?'); valores.push(p.categoria); }
  if (p.observacoes !== undefined) { campos.push('observacoes = ?'); valores.push(p.observacoes); }

  if (campos.length === 0) return;
  valores.push(id);
  await db.runAsync(`UPDATE produtos SET ${campos.join(', ')} WHERE id = ?`, valores);
}

export async function desativarProduto(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync('UPDATE produtos SET ativo = 0 WHERE id = ?', [id]);
}

export async function descontarEstoque(id: number, qtd: number): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    'UPDATE produtos SET estoque = MAX(0, estoque - ?) WHERE id = ?',
    [qtd, id]
  );
}
