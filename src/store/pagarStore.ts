export type Despesa = {
  id: string;
  descricao: string;
  fornecedor: string;
  valor: number;
  vencimento: string;
  status: 'pendente' | 'pago' | 'atrasado';
  categoria: string;
};

// Dados mockados sincronizados com o modelo da imagem do usuário
const INITIAL_MOCK_DATA: Despesa[] = [
  // A Pagar em Aberto (Total = R$ 12.450,00, 5 contas)
  {
    id: 'pagar_1',
    descricao: 'Medicamentos diversos',
    fornecedor: 'Distribuidora ABC Ltda',
    valor: 4850, // Ajustado de 2850 para que a soma das 5 contas dê exatamente os R$ 12.450,00 do card
    vencimento: '05/08/2026',
    status: 'pendente',
    categoria: 'Compras'
  },
  {
    id: 'pagar_2',
    descricao: 'Cosméticos e Perfumaria',
    fornecedor: 'Farmoquimica S.A.',
    valor: 1450,
    vencimento: '10/08/2026',
    status: 'pendente',
    categoria: 'Compras'
  },
  {
    id: 'pagar_3',
    descricao: 'Medicamentos Controlados',
    fornecedor: 'Laboratório Medley',
    valor: 3780,
    vencimento: '15/08/2026',
    status: 'pendente',
    categoria: 'Compras'
  },
  {
    id: 'pagar_4',
    descricao: 'Honorários Contábeis',
    fornecedor: 'Serviços Contábeis Ltda',
    valor: 850,
    vencimento: '20/08/2026',
    status: 'pendente',
    categoria: 'Serviços'
  },
  {
    id: 'pagar_5',
    descricao: 'Aluguel do Ponto Comercial',
    fornecedor: 'Aluguel Loja',
    valor: 1520,
    vencimento: '25/08/2026',
    status: 'pendente',
    categoria: 'Despesas'
  },
  // Despesas já pagas para compor o total de Saídas de R$ 28.340,00 (Exits paid = 15.890)
  {
    id: 'pagar_pago_1',
    descricao: 'Compra de Estoque Geral',
    fornecedor: 'Farma Distribuidora',
    valor: 8420, // Ajustado para fechar em Compras = R$ 18.500
    vencimento: '15/07/2026',
    status: 'pago',
    categoria: 'Compras'
  },
  {
    id: 'pagar_pago_2',
    descricao: 'Contas de Consumo (Luz, Água)',
    fornecedor: 'Concessionária Local',
    valor: 3780, // Ajustado para fechar em Despesas = R$ 5.300
    vencimento: '10/07/2026',
    status: 'pago',
    categoria: 'Despesas'
  },
  {
    id: 'pagar_pago_3',
    descricao: 'Manutenção de Computadores',
    fornecedor: 'TI Assistência',
    valor: 2150, // Ajustado para fechar em Serviços = R$ 3.000
    vencimento: '22/07/2026',
    status: 'pago',
    categoria: 'Serviços'
  },
  {
    id: 'pagar_pago_4',
    descricao: 'Taxas e Licenças',
    fornecedor: 'Prefeitura Municipal',
    valor: 1540, // Fecha em Outros = R$ 1.540
    vencimento: '05/07/2026',
    status: 'pago',
    categoria: 'Outros'
  }
];

let state: Despesa[] = [...INITIAL_MOCK_DATA];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export const pagarStore = {
  getState: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  addDespesa: (despesa: Despesa) => {
    state = [despesa, ...state];
    notify();
  },
  removeDespesa: (id: string) => {
    state = state.filter((d) => d.id !== id);
    notify();
  },
  toggleStatus: (id: string) => {
    state = state.map((d) => {
      if (d.id === id) {
        return { ...d, status: d.status === 'pago' ? 'pendente' : 'pago' };
      }
      return d;
    });
    notify();
  },
  atualizarCategoria: (antigoNome: string, novoNome: string) => {
    state = state.map(d => 
      d.categoria.toLowerCase() === antigoNome.toLowerCase()
        ? { ...d, category: novoNome, categoria: novoNome }
        : d
    );
    notify();
  },
  removerCategoria: (nome: string) => {
    state = state.map(d => 
      d.categoria.toLowerCase() === nome.toLowerCase()
        ? { ...d, category: 'Outros', categoria: 'Outros' }
        : d
    );
    notify();
  }
};
