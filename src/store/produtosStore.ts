// ============================================================
// Produtos Store — sincronizado com SQLite
// ============================================================
import {
  listarProdutos,
  criarProduto,
  atualizarProduto,
  desativarProduto,
  type ProdutoDB,
} from '../database/produtoRepository';

// Manter compatibilidade com tipo anterior
export type ProdutoCadastro = {
  id: string;
  codigo: string;
  nome: string;
  precoVenda: number;
  precoCusto: number | null;
  unidade: string;
  estoque: number;
  categoria: string;
  observacoes: string;
  criadoEm: string;
};

function dbParaStore(p: ProdutoDB): ProdutoCadastro {
  return {
    id: String(p.id),
    codigo: p.codigo,
    nome: p.nome,
    precoVenda: p.precoVenda,
    precoCusto: p.precoCusto,
    unidade: p.unidade,
    estoque: p.estoque,
    categoria: p.categoria,
    observacoes: p.observacoes,
    criadoEm: p.criadoEm,
  };
}

let state: ProdutoCadastro[] = [];
let _carregado = false;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export const produtosStore = {
  getState: () => state,

  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Carrega produtos do banco — deve ser chamado na inicialização */
  carregar: async () => {
    if (_carregado) return;
    const lista = await listarProdutos();
    state = lista.map(dbParaStore);
    _carregado = true;
    notify();
  },

  /** Recarrega forçado do banco */
  recarregar: async () => {
    _carregado = false;
    const lista = await listarProdutos();
    state = lista.map(dbParaStore);
    _carregado = true;
    notify();
  },

  /** Adiciona produto no banco e atualiza estado */
  addProduto: async (produto: Omit<ProdutoCadastro, 'id' | 'criadoEm'>): Promise<{ ok: boolean; msg: string }> => {
    try {
      const id = await criarProduto({
        codigo: produto.codigo,
        nome: produto.nome,
        precoVenda: produto.precoVenda,
        precoCusto: produto.precoCusto || 0,
        unidade: produto.unidade,
        estoque: produto.estoque,
        categoria: produto.categoria,
        observacoes: produto.observacoes,
      });
      const novoProduto: ProdutoCadastro = {
        ...produto,
        id: String(id),
        criadoEm: new Date().toLocaleString('pt-BR'),
      };
      state = [novoProduto, ...state];
      notify();
      return { ok: true, msg: 'Produto cadastrado.' };
    } catch (e: any) {
      return { ok: false, msg: e.message || 'Erro ao cadastrar produto.' };
    }
  },

  /** Remove produto do banco (soft delete) */
  removeProduto: async (id: string): Promise<void> => {
    await desativarProduto(Number(id));
    state = state.filter((p) => p.id !== id);
    notify();
  },

  /** Atualiza produto no banco */
  updateProduto: async (id: string, updated: Partial<ProdutoCadastro>): Promise<void> => {
    await atualizarProduto(Number(id), {
      codigo: updated.codigo,
      nome: updated.nome,
      precoVenda: updated.precoVenda,
      precoCusto: updated.precoCusto ?? undefined,
      unidade: updated.unidade,
      estoque: updated.estoque,
      categoria: updated.categoria,
      observacoes: updated.observacoes,
    });
    state = state.map((p) => (p.id === id ? { ...p, ...updated } : p));
    notify();
  },
};
