import React, { useCallback, useState, useEffect } from 'react';
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
import { Users, Trash2, X, Pencil, UserPlus } from 'lucide-react-native';
import { validarCpfCnpj, validarEmail } from '../utils/validators';
import { requestApi } from '../services/api';

export type ClienteCadastro = {
  id: string;
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  cep: string;
  endereco: string;
  cidade: string;
  uf: string;
  observacoes: string;
  criadoEm: string;
};

const emptyForm = {
  nome: '',
  documento: '',
  telefone: '',
  email: '',
  cep: '',
  endereco: '',
  cidade: '',
  uf: '',
  observacoes: '',
};

export default function ClientesScreen() {
  const { colors, isDark } = useTheme();
  const [form, setForm] = useState(emptyForm);
  const [clientes, setClientes] = useState<ClienteCadastro[]>([]);
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const carregarClientes = useCallback(async () => {
    const res = await requestApi<any[]>('/clientes');
    if (res.ok && Array.isArray(res.data)) {
      setClientes(
        res.data.map((c) => ({
          id: String(c.id),
          nome: c.nome,
          documento: c.documento || '',
          telefone: c.telefone || '',
          email: c.email || '',
          cep: c.cep || '',
          endereco: c.endereco || '',
          cidade: c.cidade || '',
          uf: c.uf || '',
          observacoes: c.observacoes || '',
          criadoEm: c.criadoEm || '',
        }))
      );
    }
  }, []);

  useEffect(() => {
    carregarClientes();
  }, [carregarClientes]);

  const fieldColor = colors.textHeader;
  const inputStyle = {
    backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    color: fieldColor,
    fontSize: 14,
  };

  const labelStyle = {
    color: isDark ? colors.textSecondary : '#64748b',
    fontSize: 12,
    fontWeight: '600' as const,
    marginBottom: 4,
    marginTop: 10,
  };

  const update = useCallback((key: keyof typeof emptyForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const salvar = useCallback(async () => {
    const nome = form.nome.trim();
    if (!nome) {
      if (Platform.OS === 'web') window.alert('Validação: Informe o nome ou razão social do cliente.');
      else Alert.alert('Validação', 'Informe o nome ou razão social do cliente.');
      return;
    }

    const doc = form.documento.trim();
    if (doc && !validarCpfCnpj(doc)) {
      if (Platform.OS === 'web') window.alert('Validação: CPF/CNPJ inválido.');
      else Alert.alert('Validação', 'CPF/CNPJ inválido.');
      return;
    }

    const email = form.email.trim();
    if (email && !validarEmail(email)) {
      if (Platform.OS === 'web') window.alert('Validação: E-mail com formato inválido.');
      else Alert.alert('Validação', 'E-mail com formato inválido.');
      return;
    }

    if (editandoId) {
      // Modo edição: atualiza o cliente existente
      await requestApi(`/clientes/${editandoId}`, {
        method: 'PUT',
        body: {
          nome,
          documento: form.documento.trim(),
          telefone: form.telefone.trim(),
          email: form.email.trim(),
          cep: form.cep.trim(),
          endereco: form.endereco.trim(),
          cidade: form.cidade.trim(),
          uf: form.uf.trim().toUpperCase().slice(0, 2),
          observacoes: form.observacoes.trim(),
        },
      });
      await carregarClientes();
      setEditandoId(null);
      setForm(emptyForm);
      setCadastroAberto(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Cliente atualizado', `${nome} foi atualizado com sucesso.`);
    } else {
      // Modo criação: adiciona novo cliente
      await requestApi('/clientes', {
        method: 'POST',
        body: {
          nome,
          documento: form.documento.trim(),
          telefone: form.telefone.trim(),
          email: form.email.trim(),
          cep: form.cep.trim(),
          endereco: form.endereco.trim(),
          cidade: form.cidade.trim(),
          uf: form.uf.trim().toUpperCase().slice(0, 2),
          observacoes: form.observacoes.trim(),
        },
      });
      await carregarClientes();
      setForm(emptyForm);
      setCadastroAberto(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Cliente cadastrado', `${nome} foi adicionado à lista.`);
    }
  }, [form, editandoId, carregarClientes]);

  const abrirEdicao = useCallback((c: ClienteCadastro) => {
    setEditandoId(c.id);
    setForm({
      nome: c.nome,
      documento: c.documento,
      telefone: c.telefone,
      email: c.email,
      cep: c.cep,
      endereco: c.endereco,
      cidade: c.cidade,
      uf: c.uf,
      observacoes: c.observacoes,
    });
    setCadastroAberto(true);
  }, []);

  const remover = useCallback(async (id: string) => {
    await requestApi(`/clientes/${id}`, { method: 'DELETE' });
    setClientes((lista) => lista.filter((c) => c.id !== id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const fecharCadastro = useCallback(() => {
    setCadastroAberto(false);
    setEditandoId(null);
    setForm(emptyForm);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 26, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 4 }}>
                Clientes
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                Cadastro de clientes do sistema
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setCadastroAberto(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.accent,
                backgroundColor: `${colors.accent}18`,
              }}
            >
              <UserPlus size={18} color={colors.accent} />
              <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Novo</Text>
            </TouchableOpacity>
          </View>

          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              color: colors.textPrimary,
              marginTop: 28,
              marginBottom: 12,
            }}
          >
            Clientes cadastrados ({clientes.length})
          </Text>

          {clientes.length === 0 ? (
            <View
              style={{
                padding: 24,
                backgroundColor: colors.headerBackground,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                Nenhum cliente cadastrado. Clique em &quot;Novo cliente&quot; para adicionar.
              </Text>
            </View>
          ) : (
            <View style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              {/* Cabeçalho da tabela */}
              <View style={[styles.tableRow, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
                <Text style={[styles.tableHeader, { color: colors.textSecondary, flex: 3 }]}>Nome</Text>
                <Text style={[styles.tableHeader, { color: colors.textSecondary, flex: 2 }]}>Documento</Text>
                <Text style={[styles.tableHeader, { color: colors.textSecondary, flex: 2 }]}>Telefone</Text>
                <Text style={[styles.tableHeader, { color: colors.textSecondary, flex: 2 }]}>Cidade/UF</Text>
                <Text style={[styles.tableHeader, { color: colors.textSecondary, flex: 2 }]}>Cadastrado em</Text>
                <View style={{ width: 72 }} />
              </View>
              {/* Linhas da tabela */}
              {clientes.map((c, index) => (
                <View
                  key={c.id}
                  style={[
                    styles.tableRow,
                    {
                      backgroundColor: index % 2 === 0
                        ? colors.headerBackground
                        : (isDark ? '#0f172a' : '#f8fafc'),
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                    },
                  ]}
                >
                  <View style={{ flex: 3, paddingRight: 4 }}>
                    <Text style={[styles.tableCell, { color: colors.textHeader, fontWeight: '600' }]} numberOfLines={1}>{c.nome}</Text>
                    {!!c.email && (
                      <Text style={[styles.tableCellSub, { color: colors.textSecondary }]} numberOfLines={1}>{c.email}</Text>
                    )}
                  </View>
                  <Text style={[styles.tableCell, { color: colors.textHeader, flex: 2 }]} numberOfLines={1}>
                    {c.documento || '—'}
                  </Text>
                  <Text style={[styles.tableCell, { color: colors.textHeader, flex: 2 }]} numberOfLines={1}>
                    {c.telefone || '—'}
                  </Text>
                  <Text style={[styles.tableCell, { color: colors.textHeader, flex: 2 }]} numberOfLines={1}>
                    {[c.cidade, c.uf].filter(Boolean).join('/') || '—'}
                  </Text>
                  <Text style={[styles.tableCell, { color: colors.textSecondary, flex: 2 }]} numberOfLines={1}>
                    {c.criadoEm}
                  </Text>
                  <View style={{ width: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                    <TouchableOpacity
                      onPress={() => abrirEdicao(c)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.actionBtn}
                    >
                      <Pencil size={14} color={colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => remover(c.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.actionBtn}
                    >
                      <Trash2 size={14} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <Modal
        visible={cadastroAberto}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={fecharCadastro}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdrop} onPress={fecharCadastro} accessibilityRole="button" accessibilityLabel="Fechar cadastro" />
          <Animated.View entering={FadeIn} style={styles.cardWrap}>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.headerBackground,
                  borderColor: colors.border,
                  shadowColor: '#000',
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {editandoId ? (
                    <Pencil size={20} color={colors.accent} />
                  ) : (
                    <UserPlus size={20} color={colors.accent} />
                  )}
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textHeader }}>
                    {editandoId ? 'Editar cliente' : 'Novo cliente'}
                  </Text>
                </View>
                <TouchableOpacity onPress={fecharCadastro} hitSlop={12} style={{ padding: 4 }}>
                  <X size={22} color={colors.textHeader} />
                </TouchableOpacity>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: Platform.OS === 'web' ? 420 : 460 }}
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                <Text style={labelStyle}>Nome / Razão social *</Text>
                <TextInput
                  value={form.nome}
                  onChangeText={(t) => update('nome', t)}
                  placeholder="Ex.: Maria Souza ou Comércio XYZ Ltda"
                  placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                  style={inputStyle}
                />

                <Text style={labelStyle}>CPF / CNPJ</Text>
                <TextInput
                  value={form.documento}
                  onChangeText={(t) => update('documento', t)}
                  placeholder="Somente números ou formatado"
                  placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                  style={inputStyle}
                />

                <Text style={labelStyle}>Telefone</Text>
                <TextInput
                  value={form.telefone}
                  onChangeText={(t) => update('telefone', t)}
                  placeholder="(00) 00000-0000"
                  placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                  keyboardType="phone-pad"
                  style={inputStyle}
                />

                <Text style={labelStyle}>E-mail</Text>
                <TextInput
                  value={form.email}
                  onChangeText={(t) => update('email', t)}
                  placeholder="email@exemplo.com"
                  placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={inputStyle}
                />

                <Text style={labelStyle}>CEP</Text>
                <TextInput
                  value={form.cep}
                  onChangeText={(t) => update('cep', t)}
                  placeholder="00000-000"
                  placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                  keyboardType="numeric"
                  style={inputStyle}
                />

                <Text style={labelStyle}>Endereço</Text>
                <TextInput
                  value={form.endereco}
                  onChangeText={(t) => update('endereco', t)}
                  placeholder="Rua, número, bairro"
                  placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                  style={inputStyle}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 2 }}>
                    <Text style={labelStyle}>Cidade</Text>
                    <TextInput
                      value={form.cidade}
                      onChangeText={(t) => update('cidade', t)}
                      placeholder="Cidade"
                      placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                      style={inputStyle}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>UF</Text>
                    <TextInput
                      value={form.uf}
                      onChangeText={(t) => update('uf', t.toUpperCase().slice(0, 2))}
                      placeholder="SP"
                      placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                      maxLength={2}
                      autoCapitalize="characters"
                      style={inputStyle}
                    />
                  </View>
                </View>

                <Text style={labelStyle}>Observações</Text>
                <TextInput
                  value={form.observacoes}
                  onChangeText={(t) => update('observacoes', t)}
                  placeholder="Anotações internas (opcional)"
                  placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                  multiline
                  numberOfLines={3}
                  style={[inputStyle, { minHeight: 72, textAlignVertical: 'top' }]}
                />

                <View style={styles.saveRow}>
                  <TouchableOpacity
                    onPress={salvar}
                    activeOpacity={0.85}
                    style={[
                      styles.saveBtn,
                      {
                        backgroundColor: colors.accent,
                      },
                    ]}
                  >
                    <Text style={styles.saveBtnText}>Salvar cliente</Text>
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
    maxWidth: 420,
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
      ios: {
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
      },
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
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  tableHeader: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableCell: {
    fontSize: 13,
    paddingRight: 6,
  },
  tableCellSub: {
    fontSize: 11,
    marginTop: 1,
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.1)',
  },
});
