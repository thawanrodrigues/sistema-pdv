import React, { useState, useSyncExternalStore } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../ui/themes/index.theme';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Calculator, ArrowDownCircle, ArrowUpCircle, X, DollarSign, FileText, ShoppingCart } from 'lucide-react-native';
import { caixaStore } from '../store/caixaStore';
import { authStore } from '../store/authStore';

export default function CaixaScreen() {
  const { colors, isDark } = useTheme();
  
  // Conectando ao estado global do Caixa
  const state = useSyncExternalStore(caixaStore.subscribe, caixaStore.getState);
  const { status, saldoAtual, totais, movimentacoes } = state;
  
  const [modalAberto, setModalAberto] = useState(false);
  const [tipoLancamento, setTipoLancamento] = useState<'entrada' | 'saida'>('entrada');
  const [valorLancamento, setValorLancamento] = useState('');
  const [descricaoLancamento, setDescricaoLancamento] = useState('');

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const abrirCaixa = async () => {
    const usuario = authStore.getUsuario();
    await caixaStore.abrirCaixa(usuario?.id ?? 0, 0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const fecharCaixa = async () => {
    if (Platform.OS === 'web') {
      const resp = window.confirm(`Deseja encerrar o caixa com saldo de ${formatarMoeda(saldoAtual)}?`);
      if (resp) {
        await caixaStore.fecharCaixa();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } else {
      Alert.alert('Fechar Caixa', `Deseja encerrar o caixa com saldo de ${formatarMoeda(saldoAtual)}?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: async () => {
            await caixaStore.fecharCaixa();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
        }
      ]);
    }
  };

  const abrirLancamento = (tipo: 'entrada' | 'saida') => {
    if (status === 'fechado') {
      if (Platform.OS === 'web') window.alert('Abra o caixa primeiro para realizar lançamentos.');
      else Alert.alert('Aviso', 'Abra o caixa primeiro para realizar lançamentos.');
      return;
    }
    setTipoLancamento(tipo);
    setValorLancamento('');
    setDescricaoLancamento('');
    setModalAberto(true);
  };

  const salvarLancamento = async () => {
    const valor = parseFloat(valorLancamento.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) {
      if (Platform.OS === 'web') window.alert('Insira um valor válido maior que zero.');
      else Alert.alert('Erro', 'Insira um valor válido maior que zero.');
      return;
    }
    if (!descricaoLancamento.trim()) {
      if (Platform.OS === 'web') window.alert('Insira uma descrição para o lançamento.');
      else Alert.alert('Erro', 'Insira uma descrição para o lançamento.');
      return;
    }

    await caixaStore.addLancamento(tipoLancamento, valor, descricaoLancamento.trim());
    setModalAberto(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <View>
              <Text style={{ fontSize: 26, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 4 }}>
                Controle de Caixa
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                {status === 'aberto' ? 'O caixa está aberto e operando.' : 'O caixa está fechado.'}
              </Text>
            </View>
            <View style={{ 
              paddingHorizontal: 12, 
              paddingVertical: 6, 
              borderRadius: 20, 
              backgroundColor: status === 'aberto' ? '#10b98120' : '#ef444420',
              borderWidth: 1,
              borderColor: status === 'aberto' ? '#10b981' : '#ef4444'
            }}>
              <Text style={{ 
                color: status === 'aberto' ? '#10b981' : '#ef4444', 
                fontWeight: 'bold',
                textTransform: 'uppercase',
                fontSize: 12
              }}>
                {status === 'aberto' ? 'Caixa Aberto' : 'Caixa Fechado'}
              </Text>
            </View>
          </View>

          {/* Cards Resumo */}
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            <View style={[styles.summaryCard, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
              <View style={styles.summaryIconWrap}>
                <DollarSign size={20} color={colors.accent} />
              </View>
              <Text style={{ color: colors.textHeader, opacity: 0.7, fontSize: 13, marginBottom: 4 }}>Saldo Atual</Text>
              <Text style={{ color: colors.textHeader, fontSize: 22, fontWeight: 'bold' }}>{formatarMoeda(saldoAtual)}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
              <View style={[styles.summaryIconWrap, { backgroundColor: '#10b98120' }]}>
                <ArrowUpCircle size={20} color="#10b981" />
              </View>
              <Text style={{ color: colors.textHeader, opacity: 0.7, fontSize: 13, marginBottom: 4 }}>Entradas do Dia</Text>
              <Text style={{ color: colors.textHeader, fontSize: 22, fontWeight: 'bold' }}>{formatarMoeda(totais.entradas)}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
              <View style={[styles.summaryIconWrap, { backgroundColor: '#8b5cf620' }]}>
                <ShoppingCart size={20} color="#8b5cf6" />
              </View>
              <Text style={{ color: colors.textHeader, opacity: 0.7, fontSize: 13, marginBottom: 4 }}>Vendas do Dia</Text>
              <Text style={{ color: colors.textHeader, fontSize: 22, fontWeight: 'bold' }}>{formatarMoeda(totais.vendas)}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
              <View style={[styles.summaryIconWrap, { backgroundColor: '#ef444420' }]}>
                <ArrowDownCircle size={20} color="#ef4444" />
              </View>
              <Text style={{ color: colors.textHeader, opacity: 0.7, fontSize: 13, marginBottom: 4 }}>Saídas do Dia</Text>
              <Text style={{ color: colors.textHeader, fontSize: 22, fontWeight: 'bold' }}>{formatarMoeda(totais.saidas)}</Text>
            </View>
          </View>

          {/* Ações do Caixa */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
            {status === 'fechado' ? (
              <TouchableOpacity onPress={abrirCaixa} style={[styles.actionBtn, { backgroundColor: colors.accent }]}>
                <Calculator size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Abrir Caixa</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={fecharCaixa} style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}>
                <Calculator size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Fechar Caixa</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              onPress={() => abrirLancamento('entrada')} 
              style={[styles.actionBtn, { backgroundColor: status === 'aberto' ? '#10b981' : '#94a3b8' }]}
              disabled={status === 'fechado'}
            >
              <ArrowUpCircle size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Suprimento</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => abrirLancamento('saida')} 
              style={[styles.actionBtn, { backgroundColor: status === 'aberto' ? '#f97316' : '#94a3b8' }]}
              disabled={status === 'fechado'}
            >
              <ArrowDownCircle size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Sangria</Text>
            </TouchableOpacity>
          </View>

          {/* Lista de Movimentações */}
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 }}>
            Movimentações do Dia
          </Text>

          {movimentacoes.length === 0 ? (
            <View style={{ padding: 24, backgroundColor: colors.headerBackground, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>Nenhuma movimentação registrada hoje.</Text>
            </View>
          ) : (
            movimentacoes.map((mov) => {
              const isEntrada = mov.tipo === 'entrada' || mov.tipo === 'abertura' || mov.tipo === 'venda';
              const isInfo = mov.tipo === 'abertura' || mov.tipo === 'fechamento';
              const isVenda = mov.tipo === 'venda';
              
              let Icon = isInfo ? FileText : (isEntrada ? ArrowUpCircle : ArrowDownCircle);
              if (isVenda) Icon = ShoppingCart;

              let iconColor = isInfo ? colors.accent : (isEntrada ? '#10b981' : '#ef4444');
              if (isVenda) iconColor = '#8b5cf6';
              
              let bgIconColor = isInfo ? colors.accent + '20' : (isEntrada ? '#10b98120' : '#ef444420');
              if (isVenda) bgIconColor = '#8b5cf620';

              return (
                <View key={mov.id} style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  padding: 16, 
                  backgroundColor: colors.headerBackground, 
                  borderRadius: 12, 
                  borderWidth: 1, 
                  borderColor: colors.border, 
                  marginBottom: 8 
                }}>
                  <View style={{ 
                    padding: 10, 
                    borderRadius: 10, 
                    backgroundColor: bgIconColor,
                    marginRight: 16
                  }}>
                    <Icon size={20} color={iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textHeader, fontWeight: '600', fontSize: 15 }}>{mov.descricao}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{mov.hora} • {mov.tipo.toUpperCase()}</Text>
                  </View>
                  <Text style={{ 
                    fontWeight: 'bold', 
                    fontSize: 16, 
                    color: isInfo ? colors.textHeader : (isEntrada ? '#10b981' : '#ef4444') 
                  }}>
                    {isEntrada ? '+' : '-'} {formatarMoeda(mov.valor)}
                  </Text>
                </View>
              )
            })
          )}
        </Animated.View>
      </ScrollView>

      {/* Modal Lançamento */}
      <Modal visible={modalAberto} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setModalAberto(false)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdrop} onPress={() => setModalAberto(false)} accessibilityRole="button" />
          <Animated.View entering={FadeIn} style={styles.cardWrap}>
            <View style={[styles.card, { backgroundColor: colors.headerBackground, borderColor: colors.border, shadowColor: '#000' }]}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {tipoLancamento === 'entrada' ? (
                    <ArrowUpCircle size={20} color="#10b981" />
                  ) : (
                    <ArrowDownCircle size={20} color="#f97316" />
                  )}
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textHeader }}>
                    {tipoLancamento === 'entrada' ? 'Novo Suprimento (Entrada)' : 'Nova Sangria (Saída)'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setModalAberto(false)} hitSlop={12} style={{ padding: 4 }}>
                  <X size={22} color={colors.textHeader} />
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 300 }} contentContainerStyle={{ paddingBottom: 16 }}>
                <Text style={labelStyle}>Valor (R$)</Text>
                <TextInput
                  value={valorLancamento}
                  onChangeText={setValorLancamento}
                  placeholder="0,00"
                  placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                  keyboardType="numeric"
                  style={inputStyle}
                />

                <Text style={labelStyle}>Descrição do Lançamento</Text>
                <TextInput
                  value={descricaoLancamento}
                  onChangeText={setDescricaoLancamento}
                  placeholder={tipoLancamento === 'entrada' ? 'Ex: Troco inicial' : 'Ex: Pagamento fornecedor'}
                  placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                  style={inputStyle}
                />

                <View style={styles.saveRow}>
                  <TouchableOpacity
                    onPress={salvarLancamento}
                    activeOpacity={0.85}
                    style={[styles.saveBtn, { backgroundColor: tipoLancamento === 'entrada' ? '#10b981' : '#f97316' }]}
                  >
                    <Text style={styles.saveBtnText}>Registrar Lançamento</Text>
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
  summaryCard: {
    flex: 1,
    minWidth: 150,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f620',
    marginBottom: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
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
    width: '100%',
    maxWidth: 400,
    paddingHorizontal: 20,
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
    marginTop: 16,
    alignItems: 'center',
  },
  saveBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
});
