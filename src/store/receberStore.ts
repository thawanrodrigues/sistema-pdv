export type Titulo = {
  id: string;
  descricao: string;
  cliente: string;
  valor: number;
  vencimento: string;
  status: 'pendente' | 'pago' | 'atrasado';
  categoria: string;
};

const INITIAL_MOCK_DATA: Titulo[] = [
  // A Receber em Aberto (Total = R$ 9.860,00, 4 contas)
  {
    id: 'receber_1',
    descricao: 'Venda de Medicamentos',
    cliente: 'João Silva',
    valor: 3000,
    vencimento: '08/08/2026',
    status: 'pendente',
    categoria: 'Vendas'
  },
  {
    id: 'receber_2',
    descricao: 'Fórmula Manipulada',
    cliente: 'Maria Souza',
    valor: 2500,
    vencimento: '12/08/2026',
    status: 'pendente',
    categoria: 'Vendas'
  },
  {
    id: 'receber_3',
    descricao: 'Repasse Convênio Farma',
    cliente: 'DrogaCorp',
    valor: 1860,
    vencimento: '18/08/2026',
    status: 'pendente',
    categoria: 'Vendas'
  },
  {
    id: 'receber_4',
    descricao: 'Consultoria Preventiva',
    cliente: 'Clínica Saúde',
    valor: 2500,
    vencimento: '28/08/2026',
    status: 'pendente',
    categoria: 'Serviços'
  },
  // Títulos já recebidos para compor o total de Entradas de R$ 45.680,00
  {
    id: 'receber_pago_1',
    descricao: 'Vendas de Balcão Mês 07',
    cliente: 'Clientes Diversos',
    valor: 25000,
    vencimento: '12/07/2026',
    status: 'pago',
    categoria: 'Vendas'
  },
  {
    id: 'receber_pago_2',
    descricao: 'Convênio Space Farma',
    cliente: 'Space Farma',
    valor: 15680,
    vencimento: '20/07/2026',
    status: 'pago',
    categoria: 'Vendas'
  },
  {
    id: 'receber_pago_3',
    descricao: 'Serviço de Orientação Farmacêutica',
    cliente: 'MedConsult',
    valor: 5000,
    vencimento: '28/07/2026',
    status: 'pago',
    categoria: 'Serviços'
  }
];

let state: Titulo[] = [...INITIAL_MOCK_DATA];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export const receberStore = {
  getState: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  addTitulo: (titulo: Titulo) => {
    state = [titulo, ...state];
    notify();
  },
  removeTitulo: (id: string) => {
    state = state.filter((t) => t.id !== id);
    notify();
  },
  toggleStatus: (id: string) => {
    state = state.map((t) => {
      if (t.id === id) {
        return { ...t, status: t.status === 'pago' ? 'pendente' : 'pago' };
      }
      return t;
    });
    notify();
  },
  atualizarCategoria: (antigoNome: string, novoNome: string) => {
    state = state.map(t => 
      t.categoria.toLowerCase() === antigoNome.toLowerCase()
        ? { ...t, category: novoNome, categoria: novoNome }
        : t
    );
    notify();
  },
  removerCategoria: (nome: string) => {
    state = state.map(t => 
      t.categoria.toLowerCase() === nome.toLowerCase()
        ? { ...t, category: 'Outros', categoria: 'Outros' }
        : t
    );
    notify();
  }
};
