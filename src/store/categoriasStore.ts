export type Categoria = {
  nome: string;
  cor: string; // hex color code
};

export type CategoriasState = {
  despesas: Categoria[];
  receitas: Categoria[];
};

const INITIAL_STATE: CategoriasState = {
  despesas: [
    { nome: 'Compras', cor: '#3b82f6' },
    { nome: 'Despesas', cor: '#ef4444' },
    { nome: 'Serviços', cor: '#8b5cf6' },
    { nome: 'Outros', cor: '#f59e0b' },
  ],
  receitas: [
    { nome: 'Vendas', cor: '#10b981' },
    { nome: 'Serviços', cor: '#8b5cf6' },
    { nome: 'Outros', cor: '#f59e0b' },
  ],
};

let state: CategoriasState = { ...INITIAL_STATE };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export const categoriasStore = {
  getState: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  
  addCategoria: (tipo: 'despesa' | 'receita', nome: string, cor: string) => {
    const listKey = tipo === 'despesa' ? 'despesas' : 'receitas';
    // Evitar duplicados por nome (case insensitive)
    const exists = state[listKey].some(c => c.nome.toLowerCase() === nome.trim().toLowerCase());
    if (exists) return { ok: false, msg: 'Uma categoria com este nome já existe.' };
    
    state = {
      ...state,
      [listKey]: [...state[listKey], { nome: nome.trim(), cor }]
    };
    notify();
    return { ok: true };
  },

  updateCategoria: (tipo: 'despesa' | 'receita', antigoNome: string, novoNome: string, novaCor: string) => {
    const listKey = tipo === 'despesa' ? 'despesas' : 'receitas';
    // Verificar se novo nome já existe e não é a mesma categoria sendo editada
    const hasDuplicate = state[listKey].some(
      c => c.nome.toLowerCase() === novoNome.trim().toLowerCase() && c.nome.toLowerCase() !== antigoNome.toLowerCase()
    );
    if (hasDuplicate) return { ok: false, msg: 'Uma categoria com este nome já existe.' };

    state = {
      ...state,
      [listKey]: state[listKey].map(c => 
        c.nome.toLowerCase() === antigoNome.toLowerCase() 
          ? { nome: novoNome.trim(), cor: novaCor } 
          : c
      )
    };
    notify();
    return { ok: true };
  },

  removeCategoria: (tipo: 'despesa' | 'receita', nome: string) => {
    const listKey = tipo === 'despesa' ? 'despesas' : 'receitas';
    // Impedir a remoção da categoria 'Outros' para servir de fallback padrão
    if (nome.toLowerCase() === 'outros') {
      return { ok: false, msg: 'A categoria padrão "Outros" não pode ser removida.' };
    }

    state = {
      ...state,
      [listKey]: state[listKey].filter(c => c.nome.toLowerCase() !== nome.toLowerCase())
    };
    notify();
    return { ok: true };
  }
};
