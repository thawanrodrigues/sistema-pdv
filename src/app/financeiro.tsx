import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet, 
  TextInput, 
  Modal, 
  Pressable, 
  KeyboardAvoidingView, 
  Platform,
  Alert
} from 'react-native';
import { useTheme } from '../ui/themes/index.theme';
import Animated, { FadeIn } from 'react-native-reanimated';
import { 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  DollarSign, 
  Calendar, 
  Filter, 
  Eye, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle as RegCircle, 
  X, 
  Clock,
  CreditCard,
  Edit2
} from 'lucide-react-native';
import Svg, { Circle, Path, G, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { pagarStore, Despesa } from '../store/pagarStore';
import { receberStore, Titulo } from '../store/receberStore';
import { categoriasStore, Categoria } from '../store/categoriasStore';
import * as Haptics from 'expo-haptics';

export default function FinanceiroScreen() {
  const { colors, isDark } = useTheme();
  
  // Abas: 'visao_geral' | 'pagar' | 'receber' | 'entradas' | 'saidas' | 'transferencias' | 'categorias'
  const [activeTab, setActiveTab] = useState<'visao_geral' | 'pagar' | 'receber' | 'entradas' | 'saidas' | 'transferencias' | 'categorias'>('visao_geral');
  
  // Consumindo os Stores
  const despesas = React.useSyncExternalStore(pagarStore.subscribe, pagarStore.getState);
  const titulos = React.useSyncExternalStore(receberStore.subscribe, receberStore.getState);
  const catsState = React.useSyncExternalStore(categoriasStore.subscribe, categoriasStore.getState);

  // Categorias Dinâmicas
  const despesaCategorias = catsState.despesas;
  const receitaCategorias = catsState.receitas;

  // helper to convert "DD/MM/AAAA" to Date object
  const converterParaData = (strData: string) => {
    const parts = strData.split('/');
    if (parts.length !== 3) return null;
    const dia = parseInt(parts[0], 10);
    const mes = parseInt(parts[1], 10) - 1;
    const ano = parseInt(parts[2], 10);
    return new Date(ano, mes, dia);
  };

  const formatarData = (d: Date | null) => {
    if (!d) return '--/--/----';
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
  };

  const hoje = new Date(2026, 7, 3); // August 3, 2026 based on local time metadata

  // Estados dos Filtros / Filtro de Data
  const [startDate, setStartDate] = useState<Date | null>(new Date(2026, 5, 1)); // 01/06/2026
  const [endDate, setEndDate] = useState<Date | null>(new Date(2026, 6, 31)); // 31/07/2026
  const [modalCalendarioAberto, setModalCalendarioAberto] = useState(false);
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date(2026, 6, 1)); // July 2026
  const [selectingField, setSelectingField] = useState<'start' | 'end'>('start');

  const dateRangeLabel = startDate && endDate 
    ? `${formatarData(startDate)} até ${formatarData(endDate)}`
    : startDate 
      ? `A partir de ${formatarData(startDate)}`
      : endDate 
        ? `Até ${formatarData(endDate)}`
        : 'Todo o Período';

  const despesasFiltradas = React.useMemo(() => {
    return despesas.filter(d => {
      const dDate = converterParaData(d.vencimento);
      if (!dDate) return true;
      if (startDate && dDate < startDate) return false;
      if (endDate && dDate > endDate) return false;
      return true;
    });
  }, [despesas, startDate, endDate]);

  const titulosFiltrados = React.useMemo(() => {
    return titulos.filter(t => {
      const tDate = converterParaData(t.vencimento);
      if (!tDate) return true;
      if (startDate && tDate < startDate) return false;
      if (endDate && tDate > endDate) return false;
      return true;
    });
  }, [titulos, startDate, endDate]);

  // Modais Lançamentos
  const [modalPagarAberto, setModalPagarAberto] = useState(false);
  const [modalReceberAberto, setModalReceberAberto] = useState(false);

  // Modal Categorias
  const [modalCategoriaAberto, setModalCategoriaAberto] = useState(false);
  const [catEditMode, setCatEditMode] = useState<'create' | 'edit'>('create');
  const [catTipo, setCatTipo] = useState<'despesa' | 'receita'>('despesa');
  const [catAntigoNome, setCatAntigoNome] = useState('');
  const [catNome, setCatNome] = useState('');
  const [catCor, setCatCor] = useState('#3b82f6');

  // Cores Paleta Pré-definida
  const paletaCores = [
    '#3b82f6', // Azul
    '#10b981', // Verde
    '#ef4444', // Vermelho
    '#8b5cf6', // Roxo
    '#f59e0b', // Laranja
    '#ec4899', // Rosa
    '#14b8a6', // Azul-turquesa
    '#eab308', // Amarelo
  ];

  // Campos Novos Lançamentos
  const [descricao, setDescricao] = useState('');
  const [entidade, setEntidade] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [categoria, setCategoria] = useState('');

  // ----------------------------------------------------
  // Cálculos Financeiros Dinâmicos
  // ----------------------------------------------------
  const totalEntradasReal = titulosFiltrados.filter(t => t.status === 'pago').reduce((sum, t) => sum + t.valor, 0);
  const totalReceberPendente = titulosFiltrados.filter(t => t.status === 'pendente').reduce((sum, t) => sum + t.valor, 0);
  
  const totalSaidasReal = despesasFiltradas.reduce((sum, d) => sum + d.valor, 0);
  const totalPagarPendente = despesasFiltradas.filter(d => d.status === 'pendente').reduce((sum, d) => sum + d.valor, 0);
  const totalPagarContasCount = despesasFiltradas.filter(d => d.status === 'pendente').length;
  const totalReceberContasCount = titulosFiltrados.filter(t => t.status === 'pendente').length;

  const saldoAnterior = 12450;
  const saldoAtual = saldoAnterior + totalEntradasReal - totalSaidasReal;

  // Formatação Moeda
  const formatarMoeda = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // ----------------------------------------------------
  // Categorias Gráfico Pizza / Donut (Donut dinâmico baseado em categorias reais)
  // ----------------------------------------------------
  const despesasPorCategoria = despesasFiltradas.reduce((acc, d) => {
    acc[d.categoria] = (acc[d.categoria] || 0) + d.valor;
    return acc;
  }, {} as Record<string, number>);

  const totalDespesasPizza = Object.values(despesasPorCategoria).reduce((sum, v) => sum + v, 0) || 1;
  
  const categoriasPizzaData = despesaCategorias.map(c => ({
    label: c.nome,
    value: despesasPorCategoria[c.nome] || 0,
    color: c.cor
  }));

  // ----------------------------------------------------
  // Salvar Categorias
  // ----------------------------------------------------
  const abrirNovaCategoria = (tipo: 'despesa' | 'receita') => {
    setCatEditMode('create');
    setCatTipo(tipo);
    setCatNome('');
    setCatCor(tipo === 'despesa' ? '#3b82f6' : '#10b981');
    setModalCategoriaAberto(true);
  };

  const abrirEditarCategoria = (tipo: 'despesa' | 'receita', cat: Categoria) => {
    setCatEditMode('edit');
    setCatTipo(tipo);
    setCatAntigoNome(cat.nome);
    setCatNome(cat.nome);
    setCatCor(cat.cor);
    setModalCategoriaAberto(true);
  };

  const salvarCategoria = () => {
    const nomeLimpo = catNome.trim();
    if (!nomeLimpo) {
      Alert.alert('Erro', 'Informe um nome válido para a categoria.');
      return;
    }

    if (catEditMode === 'create') {
      const res = categoriasStore.addCategoria(catTipo, nomeLimpo, catCor);
      if (!res.ok) {
        Alert.alert('Erro', res.msg);
        return;
      }
    } else {
      const res = categoriasStore.updateCategoria(catTipo, catAntigoNome, nomeLimpo, catCor);
      if (!res.ok) {
        Alert.alert('Erro', res.msg);
        return;
      }
      // Propagar atualização para lançamentos existentes
      if (catTipo === 'despesa') {
        pagarStore.atualizarCategoria(catAntigoNome, nomeLimpo);
      } else {
        receberStore.atualizarCategoria(catAntigoNome, nomeLimpo);
      }
    }

    setModalCategoriaAberto(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const excluirCategoria = (tipo: 'despesa' | 'receita', nome: string) => {
    if (nome.toLowerCase() === 'outros') {
      Alert.alert('Aviso', 'A categoria "Outros" é padrão do sistema e não pode ser removida.');
      return;
    }

    Alert.alert(
      'Confirmar Exclusão', 
      `Deseja mesmo remover a categoria "${nome}"? Contas vinculadas a ela serão movidas para a categoria "Outros".`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive', 
          onPress: () => {
            const res = categoriasStore.removeCategoria(tipo, nome);
            if (!res.ok) {
              Alert.alert('Erro', res.msg);
              return;
            }
            // Propagar redefinição para categoria Outros
            if (tipo === 'despesa') {
              pagarStore.removerCategoria(nome);
            } else {
              receberStore.removerCategoria(nome);
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          }
        }
      ]
    );
  };

  // ----------------------------------------------------
  // Salvar Lançamentos
  // ----------------------------------------------------
  const salvarPagar = () => {
    const valorNum = parseFloat(valor.replace(',', '.'));
    if (!descricao.trim() || !entidade.trim() || isNaN(valorNum) || valorNum <= 0 || !vencimento.trim()) {
      Alert.alert('Erro', 'Preencha todos os campos corretamente com valores válidos.');
      return;
    }
    const nova: Despesa = {
      id: `${Date.now()}`,
      descricao: descricao.trim(),
      fornecedor: entidade.trim(),
      valor: valorNum,
      vencimento: vencimento.trim(),
      status: 'pendente',
      categoria: categoria || despesaCategorias[0]?.nome || 'Compras'
    };
    pagarStore.addDespesa(nova);
    fecharModais();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const salvarReceber = () => {
    const valorNum = parseFloat(valor.replace(',', '.'));
    if (!descricao.trim() || !entidade.trim() || isNaN(valorNum) || valorNum <= 0 || !vencimento.trim()) {
      Alert.alert('Erro', 'Preencha todos os campos corretamente com valores válidos.');
      return;
    }
    const nova: Titulo = {
      id: `${Date.now()}`,
      descricao: descricao.trim(),
      cliente: entidade.trim(),
      valor: valorNum,
      vencimento: vencimento.trim(),
      status: 'pendente',
      categoria: categoria || receitaCategorias[0]?.nome || 'Vendas'
    };
    receberStore.addTitulo(nova);
    fecharModais();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const fecharModais = () => {
    setModalPagarAberto(false);
    setModalReceberAberto(false);
    setDescricao('');
    setEntidade('');
    setValor('');
    setVencimento('');
    setCategoria('');
  };

  const inputStyle = {
    backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    color: colors.textHeader,
    fontSize: 14,
  };

  const labelStyle = {
    color: isDark ? colors.textSecondary : '#64748b',
    fontSize: 12,
    fontWeight: '600' as const,
    marginBottom: 4,
    marginTop: 10,
  };

  // ----------------------------------------------------
  // Renderizadores de Gráficos (SVG)
  // ----------------------------------------------------
  const lineChartData = [
    { label: 'Fev/26', entradas: 12000, saidas: 5000, saldo: 7000 },
    { label: 'Mar/26', entradas: 15000, saidas: 8000, saldo: 7000 },
    { label: 'Abr/26', entradas: 18000, saidas: 11000, saldo: 7000 },
    { label: 'Mai/26', entradas: 17000, saidas: 9000, saldo: 8000 },
    { label: 'Jun/26', entradas: 16000, saidas: 10000, saldo: 6000 },
    { label: 'Jul/26', entradas: 18000, saidas: 12000, saldo: 6000 }
  ];

  const getLinePath = (key: 'entradas' | 'saidas' | 'saldo') => {
    return lineChartData.map((d, index) => {
      const x = 50 + index * 80;
      const y = 130 - (d[key] / 20000) * 110;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  let accumulatedPct = 0;

  const handleDayClick = (dayDate: Date) => {
    const targetDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
    
    if (selectingField === 'start') {
      setStartDate(targetDate);
      if (endDate && targetDate.getTime() > endDate.getTime()) {
        setEndDate(null);
      }
      setSelectingField('end');
    } else {
      if (startDate && targetDate.getTime() < startDate.getTime()) {
        // Swap range: if end date is before start date, treat start date as end and target as start
        setEndDate(startDate);
        setStartDate(targetDate);
      } else {
        setEndDate(targetDate);
      }
      setSelectingField('start');
    }
  };

  const changeMonth = (increment: number) => {
    setCurrentCalendarMonth(new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() + increment, 1));
  };

  const renderCalendarDays = () => {
    const daysInMonth = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() + 1, 0).getDate();
    const startDayOfWeek = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth(), 1).getDay();

    const dayViews = [];

    // Empty spaces for padding before the month starts
    for (let i = 0; i < startDayOfWeek; i++) {
      dayViews.push(
        <View key={`empty-${i}`} style={{ width: `${100 / 7}%`, height: 36 }} />
      );
    }

    // Days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth(), d);
      
      const isStart = startDate && dayDate.toDateString() === startDate.toDateString();
      const isEnd = endDate && dayDate.toDateString() === endDate.toDateString();
      const isWithin = startDate && endDate && dayDate > startDate && dayDate < endDate;

      let itemStyle: any = {
        width: `${100 / 7}%`,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 1,
      };

      let textStyle: any = {
        fontSize: 13,
        color: colors.textHeader,
      };

      let containerBgStyle: any = {};

      if (isStart || isEnd) {
        containerBgStyle = {
          backgroundColor: colors.accent,
          borderRadius: 8,
        };
        textStyle.color = '#ffffff';
        textStyle.fontWeight = 'bold';
      } else if (isWithin) {
        containerBgStyle = {
          backgroundColor: colors.accent + '25', // opacity representation
          borderRadius: 4,
        };
        textStyle.fontWeight = '600';
      }

      dayViews.push(
        <TouchableOpacity
          key={`day-${d}`}
          onPress={() => handleDayClick(dayDate)}
          style={[itemStyle, containerBgStyle]}
        >
          <Text style={textStyle}>{d}</Text>
        </TouchableOpacity>
      );
    }

    return dayViews;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 64 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn}>
          
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>FINANCEIRO</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Visão geral do financeiro da empresa</Text>
            </View>
            <View style={styles.headerControls}>
              <TouchableOpacity onPress={() => { setCategoria(despesaCategorias[0]?.nome || 'Compras'); setModalPagarAberto(true); }} style={[styles.quickActionBtn, { backgroundColor: '#ef4444' }]}>
                <Plus size={15} color="#fff" />
                <Text style={styles.quickActionBtnText}>Nova Saída</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setCategoria(receitaCategorias[0]?.nome || 'Vendas'); setModalReceberAberto(true); }} style={[styles.quickActionBtn, { backgroundColor: '#10b981' }]}>
                <Plus size={15} color="#fff" />
                <Text style={styles.quickActionBtnText}>Nova Entrada</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.headerBackground, borderColor: colors.border }]} onPress={() => setModalCalendarioAberto(true)}>
                <Calendar size={16} color={colors.accent} />
                <Text style={{ color: colors.textHeader, fontSize: 13, fontWeight: '600' }}>{dateRangeLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.headerBackground, borderColor: colors.border }]} onPress={() => Alert.alert('Filtros', 'Opções de filtros rápidos.')}>
                <Filter size={16} color={colors.accent} />
                <Text style={{ color: colors.textHeader, fontSize: 13, fontWeight: '600' }}>Filtros</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Local Tabbar Navigation */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabbar} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
            {[
              { id: 'visao_geral', label: 'Visão Geral' },
              { id: 'pagar', label: 'Contas a Pagar' },
              { id: 'receber', label: 'Contas a Receber' },
              { id: 'entradas', label: 'Entradas' },
              { id: 'saidas', label: 'Saídas' },
              { id: 'transferencias', label: 'Transferências' },
              { id: 'categorias', label: 'Categorias' }
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id as any)}
                  style={[
                    styles.tabItem,
                    isActive ? { backgroundColor: colors.accent } : { backgroundColor: colors.headerBackground, borderColor: colors.border }
                  ]}
                >
                  <Text style={[styles.tabText, isActive ? { color: '#ffffff' } : { color: colors.textHeader }]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ======================================================== */}
          {/* TAB 1: VISÃO GERAL */}
          {/* ======================================================== */}
          {activeTab === 'visao_geral' && (
            <View style={{ gap: 24, marginTop: 12 }}>
              
              {/* KPI Cards Row */}
              <View style={styles.kpiRow}>
                {/* ENTRADAS */}
                <View style={[styles.kpiCard, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
                  <View style={styles.kpiHeader}>
                    <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                      <ArrowDownToLine size={20} color="#10b981" />
                    </View>
                    <Text style={[styles.kpiTitle, { color: colors.textHeader }]}>ENTRADAS</Text>
                  </View>
                  <Text style={[styles.kpiValue, { color: colors.textHeader }]}>{formatarMoeda(totalEntradasReal)}</Text>
                  <Text style={{ fontSize: 11, color: '#10b981', fontWeight: '600', marginTop: 4 }}>
                    ↗ 12.5% em relação ao período anterior
                  </Text>
                </View>

                {/* SAÍDAS */}
                <View style={[styles.kpiCard, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
                  <View style={styles.kpiHeader}>
                    <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                      <ArrowUpFromLine size={20} color="#ef4444" />
                    </View>
                    <Text style={[styles.kpiTitle, { color: colors.textHeader }]}>SAÍDAS</Text>
                  </View>
                  <Text style={[styles.kpiValue, { color: colors.textHeader }]}>{formatarMoeda(totalSaidasReal)}</Text>
                  <Text style={{ fontSize: 11, color: '#ef4444', fontWeight: '600', marginTop: 4 }}>
                    ↗ 8.2% em relação ao período anterior
                  </Text>
                </View>

                {/* SALDO DO PERÍODO */}
                <View style={[styles.kpiCard, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
                  <View style={styles.kpiHeader}>
                    <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                      <DollarSign size={20} color="#3b82f6" />
                    </View>
                    <Text style={[styles.kpiTitle, { color: colors.textHeader }]}>SALDO DO PERÍODO</Text>
                  </View>
                  <Text style={[styles.kpiValue, { color: colors.textHeader }]}>{formatarMoeda(totalEntradasReal - totalSaidasReal)}</Text>
                  <Text style={{ fontSize: 11, color: '#3b82f6', fontWeight: '600', marginTop: 4 }}>
                    ↗ 15.3% em relação ao período anterior
                  </Text>
                </View>

                {/* A PAGAR */}
                <View style={[styles.kpiCard, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
                  <View style={styles.kpiHeader}>
                    <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                      <Clock size={20} color="#f59e0b" />
                    </View>
                    <Text style={[styles.kpiTitle, { color: colors.textHeader }]}>A PAGAR (EM ABERTO)</Text>
                  </View>
                  <Text style={[styles.kpiValue, { color: '#f59e0b' }]}>{formatarMoeda(totalPagarPendente)}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '500', marginTop: 4 }}>
                    {totalPagarContasCount} contas
                  </Text>
                </View>

                {/* A RECEBER */}
                <View style={[styles.kpiCard, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
                  <View style={styles.kpiHeader}>
                    <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
                      <DollarSign size={20} color="#8b5cf6" />
                    </View>
                    <Text style={[styles.kpiTitle, { color: colors.textHeader }]}>A RECEBER (EM ABERTO)</Text>
                  </View>
                  <Text style={[styles.kpiValue, { color: '#8b5cf6' }]}>{formatarMoeda(totalReceberPendente)}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '500', marginTop: 4 }}>
                    {totalReceberContasCount} contas
                  </Text>
                </View>
              </View>

              {/* Contas a Pagar em Aberto Table */}
              <View style={[styles.sectionCard, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textHeader }]}>CONTAS A PAGAR (EM ABERTO)</Text>
                  <TouchableOpacity onPress={() => setActiveTab('pagar')}>
                    <Text style={{ color: colors.accent, fontWeight: 'bold', fontSize: 13 }}>Ver todas →</Text>
                  </TouchableOpacity>
                </View>

                {/* Table Header */}
                <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.tableHeadText, { flex: 1.5, color: colors.textSecondary }]}>VENCIMENTO</Text>
                  <Text style={[styles.tableHeadText, { flex: 2, color: colors.textSecondary }]}>FORNECEDOR</Text>
                  <Text style={[styles.tableHeadText, { flex: 2.5, color: colors.textSecondary }]}>DESCRIÇÃO</Text>
                  <Text style={[styles.tableHeadText, { flex: 1.5, color: colors.textSecondary }]}>CATEGORIA</Text>
                  <Text style={[styles.tableHeadText, { flex: 1.5, color: colors.textSecondary, textAlign: 'right' }]}>VALOR</Text>
                  <Text style={[styles.tableHeadText, { flex: 1.5, color: colors.textSecondary, textAlign: 'center' }]}>STATUS</Text>
                  <Text style={[styles.tableHeadText, { flex: 1, color: colors.textSecondary, textAlign: 'center' }]}>AÇÕES</Text>
                </View>

                {/* Table Rows */}
                {despesasFiltradas.filter(d => d.status === 'pendente').slice(0, 5).map((d) => {
                  const catColor = despesaCategorias.find(c => c.nome.toLowerCase() === d.categoria.toLowerCase())?.cor || '#64748b';
                  return (
                    <View key={d.id} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.tableRowText, { flex: 1.5, color: colors.textHeader }]}>{d.vencimento}</Text>
                      <Text style={[styles.tableRowText, { flex: 2, color: colors.textHeader, fontWeight: 'bold' }]}>{d.fornecedor}</Text>
                      <Text style={[styles.tableRowText, { flex: 2.5, color: colors.textHeader }]}>{d.descricao}</Text>
                      
                      <View style={{ flex: 1.5, alignItems: 'flex-start' }}>
                        <View style={[styles.badge, { backgroundColor: catColor + '15' }]}>
                          <Text style={{ fontSize: 11, fontWeight: 'bold', color: catColor }}>
                            {d.categoria}
                          </Text>
                        </View>
                      </View>
                      
                      <Text style={[styles.tableRowText, { flex: 1.5, color: colors.textHeader, fontWeight: 'bold', textAlign: 'right' }]}>{formatarMoeda(d.valor)}</Text>
                      
                      <View style={{ flex: 1.5, alignItems: 'center' }}>
                        <View style={[styles.badge, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#f59e0b' }}>A VENCER</Text>
                        </View>
                      </View>

                      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                        <TouchableOpacity onPress={() => Alert.alert('Detalhes', `${d.descricao}\nFornecedor: ${d.fornecedor}\nValor: ${formatarMoeda(d.valor)}\nVencimento: ${d.vencimento}`)}>
                          <Eye size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => pagarStore.toggleStatus(d.id)}>
                          <CheckCircle2 size={16} color="#10b981" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Bottom Widgets Row */}
              <View style={styles.widgetsGrid}>
                
                {/* 1. Fluxo de Caixa */}
                <View style={[styles.widgetCard, { flex: 1.5, backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
                  <Text style={[styles.widgetTitle, { color: colors.textHeader }]}>FLUXO DE CAIXA</Text>
                  
                  {/* Legend */}
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 12, height: 3, backgroundColor: '#10b981', borderRadius: 2 }} />
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>Entradas</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 12, height: 3, backgroundColor: '#ef4444', borderRadius: 2 }} />
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>Saídas</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 12, height: 3, backgroundColor: '#3b82f6', borderRadius: 2 }} />
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>Saldo</Text>
                    </View>
                  </View>

                  <View style={{ height: 160, width: '100%' }}>
                    <Svg height="100%" width="100%" viewBox="0 0 500 150">
                      <Defs>
                        <LinearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                          <Stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </LinearGradient>
                      </Defs>

                      {[0, 5000, 10000, 15000, 20000].map((v) => {
                        const y = 130 - (v / 20000) * 110;
                        return (
                          <G key={v}>
                            <Line x1="40" y1={y} x2="480" y2={y} stroke={isDark ? '#334155' : '#e2e8f0'} strokeWidth="1" strokeDasharray="3,3" />
                            <SvgText x="18" y={y + 4} fill={isDark ? '#94a3b8' : '#64748b'} fontSize="9" textAnchor="middle">
                              {v === 0 ? '0' : `${v/1000}k`}
                            </SvgText>
                          </G>
                        );
                      })}

                      <Path d={`${getLinePath('entradas')} L 450 130 L 50 130 Z`} fill="url(#gradEntradas)" />

                      <Path d={getLinePath('entradas')} fill="none" stroke="#10b981" strokeWidth="2.5" />
                      <Path d={getLinePath('saidas')} fill="none" stroke="#ef4444" strokeWidth="2.5" />
                      <Path d={getLinePath('saldo')} fill="none" stroke="#3b82f6" strokeWidth="2.5" />

                      {lineChartData.map((d, index) => {
                        const x = 50 + index * 80;
                        const yEnt = 130 - (d.entradas / 20000) * 110;
                        const ySai = 130 - (d.saidas / 20000) * 110;
                        const ySal = 130 - (d.saldo / 20000) * 110;
                        return (
                          <G key={index}>
                            <Circle cx={x} cy={yEnt} r="3" fill="#10b981" />
                            <Circle cx={x} cy={ySai} r="3" fill="#ef4444" />
                            <Circle cx={x} cy={ySal} r="3" fill="#3b82f6" />
                            <SvgText x={x} y="145" fill={isDark ? '#94a3b8' : '#64748b'} fontSize="9" textAnchor="middle">
                              {d.label}
                            </SvgText>
                          </G>
                        );
                      })}
                    </Svg>
                  </View>
                </View>

                {/* 2. Distribuição de Saídas */}
                <View style={[styles.widgetCard, { flex: 1.2, backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
                  <Text style={[styles.widgetTitle, { color: colors.textHeader }]}>DISTRIBUIÇÃO DE SAÍDAS</Text>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 }}>
                    
                    {/* Donut Chart SVG */}
                    <View style={{ width: 120, height: 120 }}>
                      <Svg height="120" width="120" viewBox="0 0 160 160">
                        <Circle cx="80" cy="80" r="55" fill="none" stroke={isDark ? '#334155' : '#e2e8f0'} strokeWidth="15" />
                        
                        {categoriasPizzaData.map((slice) => {
                          const percentage = totalDespesasPizza > 1 ? (slice.value / totalDespesasPizza) * 100 : 0;
                          if (percentage <= 0) return null;
                          const offset = 345.57 - (345.57 * percentage) / 100;
                          const rotateAngle = -90 + (accumulatedPct / 100) * 360;
                          accumulatedPct += percentage;
                          return (
                            <Circle 
                              key={slice.label}
                              cx="80" 
                              cy="80" 
                              r="55" 
                              fill="none" 
                              stroke={slice.color} 
                              strokeWidth="15" 
                              strokeDasharray="345.57"
                              strokeDashoffset={offset}
                              transform={`rotate(${rotateAngle} 80 80)`}
                            />
                          );
                        })}
                      </Svg>
                    </View>

                    {/* Donut Legend */}
                    <View style={{ flex: 1, gap: 8 }}>
                      {categoriasPizzaData.map((slice) => {
                        const pct = totalDespesasPizza > 1 ? ((slice.value / totalDespesasPizza) * 100).toFixed(1) : '0';
                        return (
                          <View key={slice.label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: slice.color }} />
                              <Text style={{ fontSize: 11, color: colors.textHeader, fontWeight: '600' }}>{slice.label}</Text>
                            </View>
                            <Text style={{ fontSize: 11, color: colors.textSecondary }}>{pct}%</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* 3. Resumo Financeiro */}
                <View style={[styles.widgetCard, { flex: 1.1, backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
                  <Text style={[styles.widgetTitle, { color: colors.textHeader }]}>RESUMO FINANCEIRO</Text>
                  
                  <View style={{ flex: 1, justifyContent: 'space-between', marginTop: 14 }}>
                    <View style={{ gap: 10 }}>
                      <View style={styles.resumoRow}>
                        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Saldo Anterior</Text>
                        <Text style={{ color: colors.textHeader, fontWeight: 'bold', fontSize: 14 }}>{formatarMoeda(saldoAnterior)}</Text>
                      </View>
                      
                      <View style={styles.resumoRow}>
                        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Total de Entradas</Text>
                        <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 14 }}>{formatarMoeda(totalEntradasReal)}</Text>
                      </View>

                      <View style={styles.resumoRow}>
                        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Total de Saídas</Text>
                        <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 14 }}>{formatarMoeda(totalSaidasReal)}</Text>
                      </View>
                    </View>

                    <View style={[styles.saldoAtualBanner, { backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff' }]}>
                      <Text style={{ color: '#3b82f6', fontSize: 12, fontWeight: 'bold' }}>Saldo Atual</Text>
                      <Text style={{ color: '#3b82f6', fontSize: 18, fontWeight: 'bold' }}>{formatarMoeda(saldoAtual)}</Text>
                    </View>
                  </View>
                </View>
              </View>

            </View>
          )}

          {/* ======================================================== */}
          {/* TAB 2: CONTAS A PAGAR */}
          {/* ======================================================== */}
          {activeTab === 'pagar' && (
            <View style={{ marginTop: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>Lançamento de Despesas</Text>
                <TouchableOpacity 
                  onPress={() => {
                    setCategoria(despesaCategorias[0]?.nome || 'Compras');
                    setModalPagarAberto(true);
                  }} 
                  style={[styles.addBtn, { backgroundColor: '#ef4444' }]}
                >
                  <Plus size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Nova Despesa</Text>
                </TouchableOpacity>
              </View>

              <View style={{ gap: 10 }}>
                {despesasFiltradas.map(d => {
                  const isPago = d.status === 'pago';
                  const catColor = despesaCategorias.find(c => c.nome.toLowerCase() === d.categoria.toLowerCase())?.cor || '#ef4444';
                  return (
                    <View key={d.id} style={[styles.transactionItem, { backgroundColor: colors.headerBackground, borderColor: colors.border, opacity: isPago ? 0.7 : 1 }]}>
                      <TouchableOpacity onPress={() => pagarStore.toggleStatus(d.id)} style={{ marginRight: 12 }}>
                        {isPago ? <CheckCircle2 size={24} color="#10b981" /> : <RegCircle size={24} color={colors.textSecondary} />}
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ color: colors.textHeader, fontSize: 14, fontWeight: 'bold', textDecorationLine: isPago ? 'line-through' : 'none' }}>
                            {d.descricao}
                          </Text>
                          <View style={[styles.badge, { backgroundColor: catColor + '15' }]}>
                            <Text style={{ color: catColor, fontSize: 9, fontWeight: 'bold' }}>{d.categoria}</Text>
                          </View>
                        </View>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Fornecedor: {d.fornecedor} | Venc: {d.vencimento}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <Text style={{ color: isPago ? '#10b981' : colors.textHeader, fontSize: 16, fontWeight: 'bold' }}>{formatarMoeda(d.valor)}</Text>
                        <TouchableOpacity onPress={() => pagarStore.removeDespesa(d.id)}>
                          <Trash2 size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ======================================================== */}
          {/* TAB 3: CONTAS A RECEBER */}
          {/* ======================================================== */}
          {activeTab === 'receber' && (
            <View style={{ marginTop: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>Cobranças a Receber</Text>
                <TouchableOpacity 
                  onPress={() => {
                    setCategoria(receitaCategorias[0]?.nome || 'Vendas');
                    setModalReceberAberto(true);
                  }} 
                  style={[styles.addBtn, { backgroundColor: '#10b981' }]}
                >
                  <Plus size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Nova Entrada</Text>
                </TouchableOpacity>
              </View>

              <View style={{ gap: 10 }}>
                {titulosFiltrados.map(t => {
                  const isPago = t.status === 'pago';
                  const catColor = receitaCategorias.find(c => c.nome.toLowerCase() === t.categoria.toLowerCase())?.cor || '#3b82f6';
                  return (
                    <View key={t.id} style={[styles.transactionItem, { backgroundColor: colors.headerBackground, borderColor: colors.border, opacity: isPago ? 0.7 : 1 }]}>
                      <TouchableOpacity onPress={() => receberStore.toggleStatus(t.id)} style={{ marginRight: 12 }}>
                        {isPago ? <CheckCircle2 size={24} color="#10b981" /> : <RegCircle size={24} color={colors.textSecondary} />}
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ color: colors.textHeader, fontSize: 14, fontWeight: 'bold', textDecorationLine: isPago ? 'line-through' : 'none' }}>
                            {t.descricao}
                          </Text>
                          <View style={[styles.badge, { backgroundColor: catColor + '15' }]}>
                            <Text style={{ color: catColor, fontSize: 9, fontWeight: 'bold' }}>{t.categoria}</Text>
                          </View>
                        </View>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Cliente: {t.cliente} | Venc: {t.vencimento}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <Text style={{ color: isPago ? '#10b981' : colors.textHeader, fontSize: 16, fontWeight: 'bold' }}>{formatarMoeda(t.valor)}</Text>
                        <TouchableOpacity onPress={() => receberStore.removeTitulo(t.id)}>
                          <Trash2 size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ======================================================== */}
          {/* TAB 4: ENTRADAS */}
          {/* ======================================================== */}
          {activeTab === 'entradas' && (
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 }}>Histórico de Recebimentos (Entradas)</Text>
              <View style={{ gap: 10 }}>
                {titulosFiltrados.filter(t => t.status === 'pago').map(t => (
                  <View key={t.id} style={[styles.transactionItem, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
                    <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(16,185,129,0.1)', marginRight: 12 }]}>
                      <ArrowDownToLine size={18} color="#10b981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textHeader, fontSize: 14, fontWeight: 'bold' }}>{t.descricao}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Cliente: {t.cliente} | Liquidado em: {t.vencimento}</Text>
                    </View>
                    <Text style={{ color: '#10b981', fontSize: 16, fontWeight: 'bold' }}>+{formatarMoeda(t.valor)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ======================================================== */}
          {/* TAB 5: SAÍDAS */}
          {/* ======================================================== */}
          {activeTab === 'saidas' && (
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 }}>Histórico de Pagamentos (Saídas)</Text>
              <View style={{ gap: 10 }}>
                {despesasFiltradas.filter(d => d.status === 'pago').map(d => (
                  <View key={d.id} style={[styles.transactionItem, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
                    <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(239,68,68,0.1)', marginRight: 12 }]}>
                      <ArrowUpFromLine size={18} color="#ef4444" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textHeader, fontSize: 14, fontWeight: 'bold' }}>{d.descricao}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Fornecedor: {d.fornecedor} | Pago em: {d.vencimento}</Text>
                    </View>
                    <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: 'bold' }}>-{formatarMoeda(d.valor)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ======================================================== */}
          {/* TAB 6: TRANSFERÊNCIAS */}
          {/* ======================================================== */}
          {activeTab === 'transferencias' && (
            <View style={{ marginTop: 16, gap: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 }}>Movimentação de Contas (Transferências)</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>Histórico de transferências entre contas bancárias e conciliação.</Text>
              
              <View style={{ gap: 10 }}>
                {[
                  { id: '1', desc: 'Transferência para Conta Reserva', de: 'Caixa Interno', para: 'Banco do Brasil', valor: 5000, data: '30/07/2026' },
                  { id: '2', desc: 'Aporte de Capital de Giro', de: 'Conta Sócios', para: 'Banco Itaú', valor: 10000, data: '25/07/2026' },
                  { id: '3', desc: 'Conciliação de Cartão de Crédito', de: 'Adquirente Rede', para: 'Banco Itaú', valor: 8430, data: '20/07/2026' }
                ].map(t => (
                  <View key={t.id} style={[styles.transactionItem, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
                    <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(59,130,246,0.1)', marginRight: 12 }]}>
                      <CreditCard size={18} color="#3b82f6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textHeader, fontSize: 14, fontWeight: 'bold' }}>{t.desc}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Origem: {t.de} ➔ Destino: {t.para} | Data: {t.data}</Text>
                    </View>
                    <Text style={{ color: colors.textHeader, fontSize: 15, fontWeight: 'bold' }}>{formatarMoeda(t.valor)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ======================================================== */}
          {/* TAB 7: CATEGORIAS */}
          {/* ======================================================== */}
          {activeTab === 'categorias' && (
            <View style={{ marginTop: 16 }}>
              <View style={styles.widgetsGrid}>
                {/* Categorias Despesas */}
                <View style={[styles.widgetCard, { flex: 1, backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textHeader }}>Categorias de Despesa</Text>
                    <TouchableOpacity onPress={() => abrirNovaCategoria('despesa')} style={[styles.addBtn, { backgroundColor: '#ef4444', paddingVertical: 4, paddingHorizontal: 10 }]}>
                      <Plus size={14} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Nova</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ gap: 10 }}>
                    {despesaCategorias.map(c => (
                      <View key={c.nome} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: c.cor }} />
                          <Text style={{ color: colors.textHeader, fontWeight: 'bold', fontSize: 13, marginRight: 8 }}>{c.nome}</Text>
                          
                          {/* Actions */}
                          <TouchableOpacity onPress={() => abrirEditarCategoria('despesa', c)} style={{ padding: 4 }}>
                            <Edit2 size={13} color={colors.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => excluirCategoria('despesa', c.nome)} style={{ padding: 4 }}>
                            <Trash2 size={13} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                        <Text style={{ color: colors.textHeader, fontWeight: 'bold' }}>{formatarMoeda(despesasPorCategoria[c.nome] || 0)}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Categorias Receitas */}
                <View style={[styles.widgetCard, { flex: 1, backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textHeader }}>Categorias de Receita</Text>
                    <TouchableOpacity onPress={() => abrirNovaCategoria('receita')} style={[styles.addBtn, { backgroundColor: '#10b981', paddingVertical: 4, paddingHorizontal: 10 }]}>
                      <Plus size={14} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Nova</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ gap: 10 }}>
                    {receitaCategorias.map(c => {
                      const value = titulosFiltrados.filter(t => t.categoria.toLowerCase() === c.nome.toLowerCase()).reduce((sum, t) => sum + t.valor, 0);
                      return (
                        <View key={c.nome} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                            <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: c.cor }} />
                            <Text style={{ color: colors.textHeader, fontWeight: 'bold', fontSize: 13, marginRight: 8 }}>{c.nome}</Text>
                            
                            {/* Actions */}
                            <TouchableOpacity onPress={() => abrirEditarCategoria('receita', c)} style={{ padding: 4 }}>
                              <Edit2 size={13} color={colors.textSecondary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => excluirCategoria('receita', c.nome)} style={{ padding: 4 }}>
                              <Trash2 size={13} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                          <Text style={{ color: colors.textHeader, fontWeight: 'bold' }}>{formatarMoeda(value)}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>
          )}

        </Animated.View>
      </ScrollView>

      {/* ======================================================== */}
      {/* MODAL: GERENCIAR CATEGORIA (NOVA OU EDICAO) */}
      {/* ======================================================== */}
      <Modal visible={modalCategoriaAberto} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setModalCategoriaAberto(false)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdrop} onPress={() => setModalCategoriaAberto(false)} accessibilityRole="button" />
          <Animated.View entering={FadeIn} style={styles.cardWrap}>
            <View style={[styles.card, { backgroundColor: colors.headerBackground, borderColor: colors.border, shadowColor: '#000' }]}>
              <View style={styles.cardHeader}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textHeader }}>
                  {catEditMode === 'create' ? 'Nova Categoria' : 'Editar Categoria'}
                </Text>
                <TouchableOpacity onPress={() => setModalCategoriaAberto(false)} hitSlop={12} style={{ padding: 4 }}>
                  <X size={22} color={colors.textHeader} />
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 350 }} contentContainerStyle={{ paddingBottom: 16 }}>
                <Text style={labelStyle}>Nome da Categoria *</Text>
                <TextInput value={catNome} onChangeText={setCatNome} placeholder="Ex: Farmácia, Suprimentos..." placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'} style={inputStyle} />

                <Text style={labelStyle}>Selecione uma Cor *</Text>
                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 10, marginBottom: 16 }}>
                  {paletaCores.map((color) => {
                    const isSelected = catCor.toLowerCase() === color.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={color}
                        onPress={() => setCatCor(color)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: color,
                          borderWidth: isSelected ? 3 : 1,
                          borderColor: isSelected ? colors.textPrimary : 'transparent',
                        }}
                      />
                    );
                  })}
                </View>

                <View style={styles.saveRow}>
                  <TouchableOpacity onPress={salvarCategoria} activeOpacity={0.85} style={[styles.saveBtn, { backgroundColor: catTipo === 'despesa' ? '#ef4444' : '#10b981' }]}>
                    <Text style={styles.saveBtnText}>Salvar Categoria</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: NOVA DESPESA */}
      {/* ======================================================== */}
      <Modal visible={modalPagarAberto} animationType="fade" transparent statusBarTranslucent onRequestClose={fecharModais}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdrop} onPress={fecharModais} accessibilityRole="button" />
          <Animated.View entering={FadeIn} style={styles.cardWrap}>
            <View style={[styles.card, { backgroundColor: colors.headerBackground, borderColor: colors.border, shadowColor: '#000' }]}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ArrowUpFromLine size={20} color="#ef4444" />
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textHeader }}>Nova Despesa</Text>
                </View>
                <TouchableOpacity onPress={fecharModais} hitSlop={12} style={{ padding: 4 }}>
                  <X size={22} color={colors.textHeader} />
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 400 }} contentContainerStyle={{ paddingBottom: 16 }}>
                <Text style={labelStyle}>Descrição da Despesa *</Text>
                <TextInput value={descricao} onChangeText={setDescricao} placeholder="Ex: Conta de Luz, Aluguel..." placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'} style={inputStyle} />

                <Text style={labelStyle}>Fornecedor *</Text>
                <TextInput value={entidade} onChangeText={setEntidade} placeholder="Nome do fornecedor" placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'} style={inputStyle} />

                <Text style={labelStyle}>Categoria *</Text>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {despesaCategorias.map((cat) => {
                    const isSelected = categoria === cat.nome;
                    return (
                      <TouchableOpacity
                        key={cat.nome}
                        onPress={() => setCategoria(cat.nome)}
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.accent : colors.border,
                          backgroundColor: isSelected ? colors.accent + '20' : colors.headerBackground,
                        }}
                      >
                        <Text style={{ color: isSelected ? colors.accent : colors.textHeader, fontSize: 12, fontWeight: '600' }}>{cat.nome}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Valor (R$) *</Text>
                    <TextInput value={valor} onChangeText={setValor} placeholder="0,00" keyboardType="numeric" placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'} style={inputStyle} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Vencimento *</Text>
                    <TextInput value={vencimento} onChangeText={setVencimento} placeholder="DD/MM/AAAA" placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'} style={inputStyle} />
                  </View>
                </View>

                <View style={styles.saveRow}>
                  <TouchableOpacity onPress={salvarPagar} activeOpacity={0.85} style={[styles.saveBtn, { backgroundColor: '#ef4444' }]}>
                    <Text style={styles.saveBtnText}>Salvar Despesa</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: NOVO RECEBIMENTO */}
      {/* ======================================================== */}
      <Modal visible={modalReceberAberto} animationType="fade" transparent statusBarTranslucent onRequestClose={fecharModais}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdrop} onPress={fecharModais} accessibilityRole="button" />
          <Animated.View entering={FadeIn} style={styles.cardWrap}>
            <View style={[styles.card, { backgroundColor: colors.headerBackground, borderColor: colors.border, shadowColor: '#000' }]}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ArrowDownToLine size={20} color="#10b981" />
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textHeader }}>Nova Entrada a Receber</Text>
                </View>
                <TouchableOpacity onPress={fecharModais} hitSlop={12} style={{ padding: 4 }}>
                  <X size={22} color={colors.textHeader} />
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 400 }} contentContainerStyle={{ paddingBottom: 16 }}>
                <Text style={labelStyle}>Descrição da Entrada *</Text>
                <TextInput value={descricao} onChangeText={setDescricao} placeholder="Ex: Venda de Medicamentos..." placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'} style={inputStyle} />

                <Text style={labelStyle}>Cliente *</Text>
                <TextInput value={entidade} onChangeText={setEntidade} placeholder="Nome do cliente" placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'} style={inputStyle} />

                <Text style={labelStyle}>Categoria *</Text>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {receitaCategorias.map((cat) => {
                    const isSelected = categoria === cat.nome;
                    return (
                      <TouchableOpacity
                        key={cat.nome}
                        onPress={() => setCategoria(cat.nome)}
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.accent : colors.border,
                          backgroundColor: isSelected ? colors.accent + '20' : colors.headerBackground,
                        }}
                      >
                        <Text style={{ color: isSelected ? colors.accent : colors.textHeader, fontSize: 12, fontWeight: '600' }}>{cat.nome}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Valor (R$) *</Text>
                    <TextInput value={valor} onChangeText={setValor} placeholder="0,00" keyboardType="numeric" placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'} style={inputStyle} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Vencimento *</Text>
                    <TextInput value={vencimento} onChangeText={setVencimento} placeholder="DD/MM/AAAA" placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'} style={inputStyle} />
                  </View>
                </View>

                <View style={styles.saveRow}>
                  <TouchableOpacity onPress={salvarReceber} activeOpacity={0.85} style={[styles.saveBtn, { backgroundColor: '#10b981' }]}>
                    <Text style={styles.saveBtnText}>Salvar Entrada</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: SELETOR DE CALENDÁRIO */}
      {/* ======================================================== */}
      <Modal visible={modalCalendarioAberto} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setModalCalendarioAberto(false)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdrop} onPress={() => setModalCalendarioAberto(false)} accessibilityRole="button" />
          <Animated.View entering={FadeIn} style={styles.cardWrap}>
            <View style={[styles.card, { backgroundColor: colors.headerBackground, borderColor: colors.border, shadowColor: '#000' }]}>
              
              {/* Header */}
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Calendar size={20} color={colors.accent} />
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textHeader }}>Selecionar Período</Text>
                </View>
                <TouchableOpacity onPress={() => setModalCalendarioAberto(false)} hitSlop={12} style={{ padding: 4 }}>
                  <X size={22} color={colors.textHeader} />
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 550 }} contentContainerStyle={{ paddingBottom: 16 }}>
                
                {/* Presets Grid */}
                <Text style={labelStyle}>Atalhos de Período</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {[
                    { label: 'Hoje', getRange: () => [hoje, hoje] },
                    { label: 'Últimos 7 dias', getRange: () => [new Date(2026, 7, 3 - 6), hoje] },
                    { label: 'Últimos 30 dias', getRange: () => [new Date(2026, 7, 3 - 29), hoje] },
                    { label: 'Este Mês', getRange: () => [new Date(2026, 7, 1), new Date(2026, 8, 0)] },
                    { label: 'Mês Passado', getRange: () => [new Date(2026, 6, 1), new Date(2026, 7, 0)] },
                    { label: 'Todo o Período', getRange: () => [null, null] },
                  ].map((preset) => (
                    <TouchableOpacity
                      key={preset.label}
                      onPress={() => {
                        const [start, end] = preset.getRange();
                        setStartDate(start);
                        setEndDate(end);
                        setSelectingField('start');
                        if (start) {
                          setCurrentCalendarMonth(new Date(start.getFullYear(), start.getMonth(), 1));
                        }
                      }}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                      }}
                    >
                      <Text style={{ fontSize: 12, color: colors.textHeader, fontWeight: '600' }}>{preset.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Selected Dates Indicators */}
                <Text style={labelStyle}>Selecione Data de Início ou Fim</Text>
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16, backgroundColor: isDark ? '#0f172a' : '#f1f5f9', padding: 4, borderRadius: 10 }}>
                  <TouchableOpacity
                    onPress={() => setSelectingField('start')}
                    style={{
                      flex: 1,
                      padding: 8,
                      borderRadius: 8,
                      backgroundColor: selectingField === 'start' ? (isDark ? '#1e293b' : '#ffffff') : 'transparent',
                      borderWidth: 1,
                      borderColor: selectingField === 'start' ? colors.accent : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 10, color: colors.textSecondary }}>Data Início</Text>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textHeader }}>{formatarData(startDate)}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={() => setSelectingField('end')}
                    style={{
                      flex: 1,
                      padding: 8,
                      borderRadius: 8,
                      backgroundColor: selectingField === 'end' ? (isDark ? '#1e293b' : '#ffffff') : 'transparent',
                      borderWidth: 1,
                      borderColor: selectingField === 'end' ? colors.accent : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 10, color: colors.textSecondary }}>Data Fim</Text>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textHeader }}>{formatarData(endDate)}</Text>
                  </TouchableOpacity>
                </View>

                {/* Calendar Navigation */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => changeMonth(-1)} style={{ padding: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.accent, fontWeight: 'bold', fontSize: 14 }}>◀</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.textHeader }}>
                    {currentCalendarMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
                  </Text>
                  <TouchableOpacity onPress={() => changeMonth(1)} style={{ padding: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.accent, fontWeight: 'bold', fontSize: 14 }}>▶</Text>
                  </TouchableOpacity>
                </View>

                {/* Week Day Labels */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                    <Text key={day} style={{ width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: 'bold', color: colors.textSecondary }}>
                      {day}
                    </Text>
                  ))}
                </View>

                {/* Days Grid */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 }}>
                  {renderCalendarDays()}
                </View>

                {/* Actions */}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setStartDate(null);
                      setEndDate(null);
                      setSelectingField('start');
                    }}
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
                  >
                    <Text style={{ color: colors.textHeader, fontWeight: 'bold' }}>Limpar</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={() => setModalCalendarioAberto(false)}
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Aplicar Filtro</Text>
                  </TouchableOpacity>
                </View>
                
              </ScrollView>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -1,
  },
  headerControls: {
    flexDirection: 'row',
    gap: 10,
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  tabbar: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  tabItem: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  kpiCard: {
    flex: 1,
    minWidth: 180,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  kpiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiTitle: {
    fontSize: 10,
    fontWeight: '800',
    opacity: 0.6,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  sectionCard: {
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  tableHeadText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tableRowText: {
    fontSize: 13,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  widgetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  widgetCard: {
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 220,
    minWidth: 280,
  },
  widgetTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  resumoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  saldoAtualBanner: {
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  cardWrap: {
    width: '90%',
    maxWidth: 400,
    zIndex: 2,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 24 },
      android: { elevation: 12 },
      web: { boxShadow: '0 12px 40px rgba(0,0,0,0.2)' },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.35)',
  },
  saveRow: {
    marginTop: 20,
    alignItems: 'center',
  },
  saveBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  quickActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
