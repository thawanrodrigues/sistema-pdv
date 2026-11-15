import React, { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { useTheme } from '../ui/themes/index.theme';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  Users,
  UserPlus,
  Trash2,
  Pencil,
  X,
  AlertCircle,
  ShieldCheck,
  UserCog,
  Eye,
  EyeOff,
  ArrowLeft,
} from 'lucide-react-native';
import { authStore } from '../store/authStore';
import {
  listarFuncionarios,
  criarUsuario,
  toggleUsuario,
  removerUsuario,
  type Usuario,
} from '../database/authRepository';
import { validarUsuario, validarSenha } from '../utils/validation';
import { useRouter } from 'expo-router';

const emptyForm = {
  nome: '',
  usuario: '',
  senha: '',
  perfil: 'funcionario' as 'admin' | 'funcionario',
};

const PERFIL_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  admin:       { label: 'Administrador', emoji: '🔐', color: '#8b5cf6' },
  funcionario: { label: 'Operador',      emoji: '🧑‍💼', color: '#3b82f6' },
};

export default function FuncionariosScreen() {
  const { colors, isDark } = useTheme();
  const authState = useSyncExternalStore(authStore.subscribe, authStore.getState);
  const isAdmin = authStore.isAdmin();
  const router = useRouter();

  const [funcionarios, setFuncionarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [senhaVisivel, setSenhaVisivel] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const funcs = await listarFuncionarios();
      setFuncionarios(funcs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirNovo = () => {
    setEditandoId(null);
    setForm(emptyForm);
    setErro('');
    setSenhaVisivel(false);
    setModalAberto(true);
  };

  const abrirEdicao = (f: Usuario) => {
    setEditandoId(f.id);
    setForm({ nome: f.nome, usuario: f.usuario, senha: '', perfil: f.perfil as 'admin' | 'funcionario' });
    setErro('');
    setSenhaVisivel(false);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditandoId(null);
    setForm(emptyForm);
    setErro('');
  };

  const salvar = async () => {
    setErro('');
    if (!form.nome.trim()) { setErro('Nome obrigatório.'); return; }
    const uVal = validarUsuario(form.usuario);
    if (!uVal.ok) { setErro(uVal.msg); return; }

    if (!editandoId) {
      // Criar novo
      const sVal = validarSenha(form.senha);
      if (!sVal.ok) { setErro(sVal.msg); return; }
      const result = await criarUsuario({
        nome: form.nome.trim(),
        usuario: form.usuario.trim().toLowerCase(),
        senha: form.senha,
        perfil: form.perfil,
      });
      if (!result.ok) { setErro(result.msg); return; }
    }
    // Nota: edição de funcionário existente (nome/perfil) pode ser implementada
    // via authRepository.atualizarUsuario quando disponível.

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    fecharModal();
    await carregar();
  };

  const handleToggle = async (id: number, ativo: boolean) => {
    await toggleUsuario(id, !ativo);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await carregar();
  };

  const handleRemover = async (id: number) => {
    if (id === authState.usuario?.id) {
      if (Platform.OS === 'web') window.alert('Você não pode remover seu próprio usuário.');
      return;
    }
    const confirmar = Platform.OS === 'web'
      ? window.confirm('Remover este funcionário?')
      : true;
    if (!confirmar) return;
    await removerUsuario(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await carregar();
  };

  const inputStyle = {
    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
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
    marginTop: 12,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn}>

          {/* Voltar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <TouchableOpacity
              onPress={() => router.push('/config')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}
            >
              <ArrowLeft size={20} color={colors.textPrimary} />
              <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 15 }}>Voltar para Configurações</Text>
            </TouchableOpacity>
          </View>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <View>
              <Text style={{ fontSize: 26, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 4 }}>
                Funcionários
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                Gerencie usuários e níveis de acesso
              </Text>
            </View>
            {isAdmin && (
              <TouchableOpacity
                onPress={abrirNovo}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingVertical: 8, paddingHorizontal: 14,
                  borderRadius: 10, borderWidth: 1,
                  borderColor: colors.accent,
                  backgroundColor: `${colors.accent}18`,
                }}
              >
                <UserPlus size={18} color={colors.accent} />
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Novo Funcionário</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Aviso não-admin */}
          {!isAdmin && (
            <View style={{ backgroundColor: '#fffbeb', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#fde68a', flexDirection: 'row', gap: 8 }}>
              <AlertCircle size={16} color="#d97706" />
              <Text style={{ fontSize: 13, color: '#92400e', flex: 1 }}>
                Apenas administradores podem gerenciar funcionários.
              </Text>
            </View>
          )}

          {/* Legenda de Níveis */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            {Object.entries(PERFIL_LABELS).map(([key, val]) => (
              <View key={key} style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
                padding: 12, borderRadius: 10, borderWidth: 1,
                borderColor: val.color + '40',
                backgroundColor: val.color + '12',
              }}>
                {key === 'admin'
                  ? <ShieldCheck size={20} color={val.color} />
                  : <UserCog size={20} color={val.color} />}
                <View>
                  <Text style={{ fontWeight: '700', color: val.color, fontSize: 13 }}>{val.label}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                    {key === 'admin' ? 'Acesso total ao sistema' : 'Acesso ao Terminal PDV'}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Tabela de Funcionários */}
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 }}>
            Usuários Cadastrados ({funcionarios.length})
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.accent} size="large" style={{ marginTop: 40 }} />
          ) : funcionarios.length === 0 ? (
            <View style={{ padding: 32, alignItems: 'center', backgroundColor: colors.headerBackground, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
              <Users size={40} color={colors.textSecondary} style={{ marginBottom: 12 }} />
              <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
                Nenhum funcionário cadastrado.{'\n'}Clique em &quot;Novo Funcionário&quot; para adicionar.
              </Text>
            </View>
          ) : (
            <View style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              {/* Cabeçalho */}
              <View style={[styles.tableRow, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
                <Text style={[styles.tableHeader, { color: colors.textSecondary, flex: 3 }]}>Nome / Usuário</Text>
                <Text style={[styles.tableHeader, { color: colors.textSecondary, flex: 2 }]}>Nível de Acesso</Text>
                <Text style={[styles.tableHeader, { color: colors.textSecondary, flex: 1, textAlign: 'center' }]}>Ativo</Text>
                <View style={{ width: 80 }} />
              </View>

              {funcionarios.map((f, index) => {
                const perfil = PERFIL_LABELS[f.perfil] ?? PERFIL_LABELS.funcionario;
                const isSelf = f.id === authState.usuario?.id;
                return (
                  <View
                    key={f.id}
                    style={[
                      styles.tableRow,
                      {
                        backgroundColor: index % 2 === 0
                          ? colors.headerBackground
                          : (isDark ? '#0f172a' : '#f8fafc'),
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        opacity: f.ativo ? 1 : 0.5,
                      },
                    ]}
                  >
                    {/* Nome + usuário */}
                    <View style={{ flex: 3, paddingRight: 4 }}>
                      <Text style={[styles.tableCell, { color: colors.textHeader, fontWeight: '700' }]} numberOfLines={1}>
                        {f.nome}{isSelf ? ' (você)' : ''}
                      </Text>
                      <Text style={[styles.tableCellSub, { color: colors.textSecondary }]} numberOfLines={1}>
                        @{f.usuario}
                      </Text>
                    </View>

                    {/* Perfil */}
                    <View style={{ flex: 2, paddingRight: 4 }}>
                      <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
                        backgroundColor: perfil.color + '18',
                        alignSelf: 'flex-start',
                      }}>
                        {f.perfil === 'admin'
                          ? <ShieldCheck size={12} color={perfil.color} />
                          : <UserCog size={12} color={perfil.color} />}
                        <Text style={{ fontSize: 11, fontWeight: '700', color: perfil.color }}>
                          {perfil.label}
                        </Text>
                      </View>
                    </View>

                    {/* Toggle ativo */}
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Switch
                        value={f.ativo === 1}
                        onValueChange={() => { if (isAdmin) handleToggle(f.id, f.ativo === 1); }}
                        trackColor={{ false: '#94a3b8', true: colors.accent }}
                        disabled={isSelf || !isAdmin}
                      />
                    </View>

                    {/* Ações */}
                    <View style={{ width: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      {isAdmin && (
                        <TouchableOpacity
                          onPress={() => abrirEdicao(f)}
                          style={styles.actionBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Pencil size={14} color={colors.accent} />
                        </TouchableOpacity>
                      )}
                      {isAdmin && !isSelf && (
                        <TouchableOpacity
                          onPress={() => handleRemover(f.id)}
                          style={styles.actionBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 size={14} color="#ef4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Modal Cadastro / Edição */}
      <Modal
        visible={modalAberto}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={fecharModal}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={fecharModal} />
          <Animated.View entering={FadeIn} style={styles.cardWrap}>
            <View style={[styles.card, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>

              {/* Cabeçalho modal */}
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {editandoId ? <Pencil size={20} color={colors.accent} /> : <UserPlus size={20} color={colors.accent} />}
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textHeader }}>
                    {editandoId ? 'Editar Funcionário' : 'Novo Funcionário'}
                  </Text>
                </View>
                <TouchableOpacity onPress={fecharModal} hitSlop={12} style={{ padding: 4 }}>
                  <X size={22} color={colors.textHeader} />
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                {/* Erro */}
                {!!erro && (
                  <View style={{ flexDirection: 'row', gap: 6, backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#fecaca' }}>
                    <AlertCircle size={14} color="#ef4444" />
                    <Text style={{ fontSize: 12, color: '#ef4444', flex: 1 }}>{erro}</Text>
                  </View>
                )}

                <Text style={labelStyle}>Nome completo *</Text>
                <TextInput
                  value={form.nome}
                  onChangeText={(t) => setForm((f) => ({ ...f, nome: t }))}
                  placeholder="Ex.: João Silva"
                  placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                  style={inputStyle}
                />

                <Text style={labelStyle}>Usuário (login) *</Text>
                <TextInput
                  value={form.usuario}
                  onChangeText={(t) => setForm((f) => ({ ...f, usuario: t.toLowerCase().replace(/\s/g, '') }))}
                  placeholder="joao.caixa"
                  autoCapitalize="none"
                  placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                  style={inputStyle}
                  editable={!editandoId}
                />

                {!editandoId && (
                  <>
                    <Text style={labelStyle}>Senha (mín. 6 caracteres) *</Text>
                    <View style={{ position: 'relative' }}>
                      <TextInput
                        value={form.senha}
                        onChangeText={(t) => setForm((f) => ({ ...f, senha: t }))}
                        placeholder="••••••••"
                        secureTextEntry={!senhaVisivel}
                        placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                        style={inputStyle}
                      />
                      <TouchableOpacity
                        onPress={() => setSenhaVisivel((v) => !v)}
                        style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}
                      >
                        {senhaVisivel
                          ? <EyeOff size={16} color={colors.textSecondary} />
                          : <Eye size={16} color={colors.textSecondary} />}
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                <Text style={labelStyle}>Nível de Acesso *</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  {(['funcionario', 'admin'] as const).map((p) => {
                    const info = PERFIL_LABELS[p];
                    const selected = form.perfil === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        onPress={() => setForm((f) => ({ ...f, perfil: p }))}
                        style={{
                          flex: 1, paddingVertical: 12, paddingHorizontal: 10,
                          borderRadius: 10, alignItems: 'center', gap: 4,
                          borderWidth: 2,
                          borderColor: selected ? info.color : colors.border,
                          backgroundColor: selected ? info.color + '15' : (isDark ? '#1e293b' : '#f8fafc'),
                        }}
                      >
                        {p === 'admin'
                          ? <ShieldCheck size={20} color={selected ? info.color : colors.textSecondary} />
                          : <UserCog size={20} color={selected ? info.color : colors.textSecondary} />}
                        <Text style={{ fontSize: 12, fontWeight: '700', color: selected ? info.color : colors.textSecondary }}>
                          {info.label}
                        </Text>
                        <Text style={{ fontSize: 10, color: selected ? info.color : colors.textSecondary, textAlign: 'center' }}>
                          {p === 'admin' ? 'Acesso total' : 'Terminal PDV'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  onPress={salvar}
                  activeOpacity={0.85}
                  style={{
                    marginTop: 20, backgroundColor: colors.accent,
                    paddingVertical: 13, borderRadius: 10,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                    {editandoId ? 'Salvar Alterações' : 'Cadastrar Funcionário'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tableHeader: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableCell: { fontSize: 13, paddingRight: 4 },
  tableCellSub: { fontSize: 11, marginTop: 1 },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.1)',
  },
  modalRoot: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.6)' },
  cardWrap: { width: '100%', maxWidth: 440, paddingHorizontal: 20, zIndex: 2 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    ...Platform.select({
      web: { boxShadow: '0 16px 48px rgba(0,0,0,0.25)' },
      ios: { shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 24 },
      android: { elevation: 12 },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.35)',
  },
});
