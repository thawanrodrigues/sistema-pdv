// ============================================================
// Caixa Store — sincronizado com SQLite
// ============================================================
import {
  getCaixaAberto,
  abrirCaixa as dbAbrirCaixa,
  fecharCaixa as dbFecharCaixa,
  addMovimentacao,
  getTotaisCaixa,
  getMovimentacoes,
  type Movimentacao,
} from '../database/caixaRepository';

export type CaixaState = {
  status: 'aberto' | 'fechado';
  caixaId: number | null;
  saldoAtual: number;
  totais: {
    entradas: number;
    saidas: number;
    vendas: number;
  };
  movimentacoes: Movimentacao[];
};

let state: CaixaState = {
  status: 'fechado',
  caixaId: null,
  saldoAtual: 0,
  totais: { entradas: 0, saidas: 0, vendas: 0 },
  movimentacoes: [],
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

async function sincronizarTotais(caixaId: number) {
  const [totais, movs] = await Promise.all([
    getTotaisCaixa(caixaId),
    getMovimentacoes(caixaId),
  ]);
  state = {
    ...state,
    saldoAtual: totais.saldoAtual,
    totais: {
      entradas: totais.entradas,
      saidas: totais.saidas,
      vendas: totais.vendas,
    },
    movimentacoes: movs,
  };
  notify();
}

export const caixaStore = {
  getState: () => state,

  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Inicializa: verifica se há caixa aberto no banco */
  init: async () => {
    const caixaAberto = await getCaixaAberto();
    if (caixaAberto) {
      state = { ...state, status: 'aberto', caixaId: caixaAberto.id };
      await sincronizarTotais(caixaAberto.id);
    } else {
      state = {
        status: 'fechado',
        caixaId: null,
        saldoAtual: 0,
        totais: { entradas: 0, saidas: 0, vendas: 0 },
        movimentacoes: [],
      };
      notify();
    }
  },

  abrirCaixa: async (usuarioId: number, saldoAbertura = 0) => {
    if (state.status === 'aberto') return;
    const caixaId = await dbAbrirCaixa(usuarioId, saldoAbertura);
    state = { ...state, status: 'aberto', caixaId };
    await sincronizarTotais(caixaId);
  },

  fecharCaixa: async () => {
    if (state.status === 'fechado' || !state.caixaId) return;
    await dbFecharCaixa(state.caixaId, state.saldoAtual);
    state = {
      status: 'fechado',
      caixaId: null,
      saldoAtual: 0,
      totais: { entradas: 0, saidas: 0, vendas: 0 },
      movimentacoes: [],
    };
    notify();
  },

  addLancamento: async (tipo: 'entrada' | 'saida', valor: number, descricao: string) => {
    if (state.status === 'fechado' || !state.caixaId) return;
    await addMovimentacao(state.caixaId, tipo, descricao, valor);
    await sincronizarTotais(state.caixaId);
  },

  registrarVenda: async (valor: number, metodo: string) => {
    if (state.status === 'fechado' || !state.caixaId) return;
    await addMovimentacao(state.caixaId, 'venda', `Venda (${metodo})`, valor);
    await sincronizarTotais(state.caixaId);
  },
};
