import React, { useState } from 'react';
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
import { ArrowUpFromLine, Plus, CheckCircle2, Circle, Clock, Trash2, X, DollarSign } from 'lucide-react-native';
import { pagarStore, Despesa } from '../store/pagarStore';
import { categoriasStore } from '../store/categoriasStore';

export default function PagarScreen() {
  const { colors, isDark } = useTheme();
  
  const despesas = React.useSyncExternalStore(pagarStore.subscribe, pagarStore.getState);
  const catsState = React.useSyncExternalStore(categoriasStore.subscribe, categoriasStore.getState);
  const categoriasList = catsState.despesas.map(c => c.nome);

  const [modalAberto, setModalAberto] = useState(false);
  
  const [descricao, setDescricao] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [categoria, setCategoria] = useState('');

  const formatarMoeda = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const salvarDespesa = () => {
    const valorNum = parseFloat(valor.replace(',', '.'));
    if (!descricao.trim() || !fornecedor.trim() || isNaN(valorNum) || valorNum <= 0 || !vencimento.trim()) {
      Alert.alert('Erro', 'Preencha todos os campos corretamente com valores válidos.');
      return;
    }

    const novaDespesa: Despesa = {
      id: `${Date.now()}`,
      descricao: descricao.trim(),
      fornecedor: fornecedor.trim(),
      valor: valorNum,
      vencimento: vencimento.trim(),
      status: 'pendente',
      categoria: categoria || categoriasList[0] || 'Compras'
    };

    pagarStore.addDespesa(novaDespesa);
    setModalAberto(false);
    setDescricao('');
    setFornecedor('');
    setValor('');
    setVencimento('');
    setCategoria('Compras');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const alternarStatus = (id: string) => {
    pagarStore.toggleStatus(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const excluirDespesa = (id: string) => {
    Alert.alert('Excluir', 'Tem certeza que deseja remover esta conta a pagar?', [
      { text: 'Cancelar', style: 'cancel' },
      { 
        text: 'Excluir', 
        style: 'destructive', 
        onPress: () => {
          pagarStore.removeDespesa(id);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      }
    ]);
  };

  const totais = despesas.reduce((acc, d) => {
    if (d.status === 'pendente' || d.status === 'atrasado') {
      acc.pendente += d.valor;
    } else {
      acc.pago += d.valor;
    }
    return acc;
  }, { pendente: 0, pago: 0 });

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
                Contas a Pagar
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                Gerencie suas despesas e pagamentos
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => {
                setCategoria(categoriasList[0] || 'Compras');
                setModalAberto(true);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 10,
                backgroundColor: '#ef4444'
              }}
            >
              <Plus size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Nova Despesa</Text>
            </TouchableOpacity>
          </View>

          {/* Cards Resumo */}
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
            <View style={[styles.summaryCard, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
              <View style={[styles.summaryIconWrap, { backgroundColor: '#ef444420' }]}>
                <ArrowUpFromLine size={20} color="#ef4444" />
              </View>
              <Text style={{ color: colors.textHeader, opacity: 0.7, fontSize: 13, marginBottom: 4 }}>Total a Pagar</Text>
              <Text style={{ color: colors.textHeader, fontSize: 24, fontWeight: 'bold' }}>{formatarMoeda(totais.pendente)}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
              <View style={[styles.summaryIconWrap, { backgroundColor: '#3b82f620' }]}>
                <DollarSign size={20} color="#3b82f6" />
              </View>
              <Text style={{ color: colors.textHeader, opacity: 0.7, fontSize: 13, marginBottom: 4 }}>Total Pago</Text>
              <Text style={{ color: colors.textHeader, fontSize: 24, fontWeight: 'bold' }}>{formatarMoeda(totais.pago)}</Text>
            </View>
          </View>

          {/* Lista de Despesas */}
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 }}>
            Despesas ({despesas.length})
          </Text>

          {despesas.length === 0 ? (
            <View style={{ padding: 24, backgroundColor: colors.headerBackground, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>Nenhuma conta a pagar cadastrada.</Text>
            </View>
          ) : (
            despesas.map((d) => {
              const isPago = d.status === 'pago';
              return (
                <View key={d.id} style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  padding: 16, 
                  backgroundColor: colors.headerBackground, 
                  borderRadius: 12, 
                  borderWidth: 1, 
                  borderColor: isPago ? '#10b98150' : colors.border, 
                  marginBottom: 10,
                  opacity: isPago ? 0.7 : 1
                }}>
                  <TouchableOpacity onPress={() => alternarStatus(d.id)} style={{ marginRight: 16 }}>
                    {isPago ? <CheckCircle2 size={28} color="#10b981" /> : <Circle size={28} color={colors.textSecondary} />}
                  </TouchableOpacity>
                  
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={{ color: colors.textHeader, fontWeight: 'bold', fontSize: 15, textDecorationLine: isPago ? 'line-through' : 'none' }}>
                        {d.descricao}
                      </Text>
                      <View style={{
                        paddingVertical: 2,
                        paddingHorizontal: 8,
                        borderRadius: 6,
                        backgroundColor: isPago ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: isPago ? '#10b981' : '#f59e0b' }}>
                          {d.categoria || 'Geral'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{d.fornecedor}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 }}>
                      <Clock size={12} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Venc: {d.vencimento}</Text>
                    </View>
                  </View>
                  
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 18, color: isPago ? '#10b981' : colors.textPrimary }}>
                      {formatarMoeda(d.valor)}
                    </Text>
                    <TouchableOpacity onPress={() => excluirDespesa(d.id)} style={{ padding: 8, marginTop: 4 }}>
                      <Trash2 size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              )
            })
          )}
        </Animated.View>
      </ScrollView>

      {/* Modal Nova Despesa */}
      <Modal visible={modalAberto} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setModalAberto(false)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdrop} onPress={() => setModalAberto(false)} accessibilityRole="button" />
          <Animated.View entering={FadeIn} style={styles.cardWrap}>
            <View style={[styles.card, { backgroundColor: colors.headerBackground, borderColor: colors.border, shadowColor: '#000' }]}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ArrowUpFromLine size={20} color="#ef4444" />
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textHeader }}>Nova Despesa</Text>
                </View>
                <TouchableOpacity onPress={() => setModalAberto(false)} hitSlop={12} style={{ padding: 4 }}>
                  <X size={22} color={colors.textHeader} />
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 400 }} contentContainerStyle={{ paddingBottom: 16 }}>
                <Text style={labelStyle}>Descrição da Despesa *</Text>
                <TextInput
                  value={descricao}
                  onChangeText={setDescricao}
                  placeholder="Ex: Conta de Luz, Aluguel..."
                  placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                  style={inputStyle}
                />

                <Text style={labelStyle}>Fornecedor *</Text>
                <TextInput
                  value={fornecedor}
                  onChangeText={setFornecedor}
                  placeholder="Nome do fornecedor"
                  placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                  style={inputStyle}
                />

                <Text style={labelStyle}>Categoria *</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {categoriasList.map((cat) => {
                    const isSelected = categoria === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setCategoria(cat)}
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.accent : colors.border,
                          backgroundColor: isSelected ? colors.accent + '20' : colors.headerBackground,
                        }}
                      >
                        <Text style={{ color: isSelected ? colors.accent : colors.textHeader, fontSize: 13, fontWeight: '600' }}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Valor (R$) *</Text>
                    <TextInput
                      value={valor}
                      onChangeText={setValor}
                      placeholder="0,00"
                      keyboardType="numeric"
                      placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                      style={inputStyle}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Vencimento *</Text>
                    <TextInput
                      value={vencimento}
                      onChangeText={setVencimento}
                      placeholder="DD/MM/AAAA"
                      placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                      style={inputStyle}
                    />
                  </View>
                </View>

                <View style={styles.saveRow}>
                  <TouchableOpacity
                    onPress={salvarDespesa}
                    activeOpacity={0.85}
                    style={[styles.saveBtn, { backgroundColor: '#ef4444' }]}
                  >
                    <Text style={styles.saveBtnText}>Salvar Despesa</Text>
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
    maxWidth: 240,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  summaryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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
});
