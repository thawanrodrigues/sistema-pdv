import React, { useState, useEffect, useSyncExternalStore } from 'react';
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
} from 'react-native';
import { useTheme } from '../ui/themes/index.theme';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Building2, Printer, Smartphone, Save, ShieldCheck, Banknote, AlertCircle, CheckCircle2, Zap, KeyRound, ChevronRight, ArrowLeft, UserCog } from 'lucide-react-native';
import { configStore } from '../store/configStore';
import { authStore } from '../store/authStore';
import {
  getEmpresa,
  salvarEmpresa,
} from '../database/authRepository';
import { formatarCNPJ } from '../utils/validation';
import { validarCpfCnpj } from '../utils/validators';
import { useRouter } from 'expo-router';

export default function ConfigScreen() {
  const { colors, isDark } = useTheme();
  const authState = useSyncExternalStore(authStore.subscribe, authStore.getState);
  const isAdmin = authStore.isAdmin();
  const router = useRouter();

  // Seções: menu principal, dados da empresa, integração pix, pdv, sistema
  const [activeSection, setActiveSection] = useState<'menu' | 'empresa' | 'pix' | 'pdv' | 'sistema'>('menu');

  // Empresa
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');

  // PDV / Impressão
  const configInit = configStore.getState();
  const [impressoraPadrao, setImpressoraPadrao] = useState(configInit.impressoraPadrao);
  const [imprimirAutomatico, setImprimirAutomatico] = useState(configInit.imprimirAutomatico);
  const [somAviso, setSomAviso] = useState(configInit.somAviso);
  const [etiquetaLargura, setEtiquetaLargura] = useState(String(configInit.etiquetaLargura));
  const [etiquetaAltura, setEtiquetaAltura] = useState(String(configInit.etiquetaAltura));

  // Pix
  const [pixChave, setPixChave] = useState(configInit.pixChave);
  const [pixTitular, setPixTitular] = useState(configInit.pixTitular);
  const [apiProvedor, setApiProvedor] = useState(configInit.apiProvedor);
  const [apiToken, setApiToken] = useState(configInit.apiToken);
  const [apiSecret, setApiSecret] = useState(configInit.apiSecret);

  // UI state
  const [salvando, setSalvando] = useState(false);
  const [msgSalvo, setMsgSalvo] = useState('');
  const [isErrorMsg, setIsErrorMsg] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const empresa = await getEmpresa();
      if (empresa) {
        setRazaoSocial(empresa.razao_social || '');
        setCnpj(empresa.cnpj || '');
        setTelefone(empresa.telefone || '');
        setEndereco(empresa.endereco || '');
        setPixChave(empresa.pix_chave || '');
        setPixTitular(empresa.pix_titular || '');
        setApiProvedor(empresa.api_provedor || '');
        setApiToken(empresa.api_token || '');
        setApiSecret(empresa.api_secret || '');
      }
    } catch {}
  };

  const salvarConfiguracoes = async () => {
    if (!razaoSocial.trim()) {
      showMsg('A Razão Social é obrigatória.', true);
      return;
    }
    
    if (cnpj.trim() && !validarCpfCnpj(cnpj)) {
      showMsg('CNPJ com formato inválido.', true);
      return;
    }

    setSalvando(true);
    try {
      await salvarEmpresa({
        razaoSocial: razaoSocial.trim(),
        cnpj: cnpj.trim(),
        telefone: telefone.trim(),
        endereco: endereco.trim(),
        pixChave: pixChave.trim(),
        pixTitular: pixTitular.trim(),
        apiProvedor: apiProvedor.trim(),
        apiToken: apiToken.trim(),
        apiSecret: apiSecret.trim(),
      });
      configStore.setConfig({
        pixChave,
        pixTitular,
        apiProvedor,
        apiToken,
        apiSecret,
        impressoraPadrao,
        imprimirAutomatico,
        somAviso,
        etiquetaLargura: parseInt(etiquetaLargura, 10) || 50,
        etiquetaAltura: parseInt(etiquetaAltura, 10) || 30,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showMsg('Configurações salvas com sucesso!');
    } finally {
      setSalvando(false);
    }
  };

  const showMsg = (msg: string, isError = false) => {
    setMsgSalvo(msg);
    setIsErrorMsg(isError);
    setTimeout(() => {
      setMsgSalvo('');
      setIsErrorMsg(false);
    }, 3000);
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
    marginTop: 10,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn}>
          {/* Cabeçalho condicional */}
          {activeSection === 'menu' ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.textPrimary }}>Configurações</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                {isAdmin ? 'Acesso total — Administrador' : 'Acesso limitado — Funcionário'}
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <TouchableOpacity
                onPress={() => setActiveSection('menu')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}
              >
                <ArrowLeft size={20} color={colors.textPrimary} />
                <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 15 }}>Voltar para o menu</Text>
              </TouchableOpacity>

              {activeSection !== 'sistema' && (
                <TouchableOpacity
                  onPress={salvarConfiguracoes}
                  disabled={salvando || !isAdmin}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingVertical: 9, paddingHorizontal: 16,
                    borderRadius: 10,
                    backgroundColor: isAdmin ? colors.accent : '#94a3b8',
                  }}
                >
                  {salvando ? <ActivityIndicator size="small" color="#fff" /> : <Save size={16} color="#fff" />}
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Salvar</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Alertas */}
          {!!msgSalvo && (
            <View style={{
              flexDirection: 'row',
              gap: 8,
              backgroundColor: isErrorMsg ? '#fef2f2' : '#f0fdf4',
              borderRadius: 8,
              padding: 10,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: isErrorMsg ? '#fecaca' : '#bbf7d0',
            }}>
              {isErrorMsg ? <AlertCircle size={16} color="#dc2626" /> : <CheckCircle2 size={16} color="#16a34a" />}
              <Text style={{ color: isErrorMsg ? '#dc2626' : '#16a34a', fontSize: 13, flex: 1 }}>{msgSalvo}</Text>
            </View>
          )}

          {!isAdmin && activeSection === 'menu' && (
            <View style={{ backgroundColor: '#fffbeb', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#fde68a', flexDirection: 'row', gap: 8 }}>
              <AlertCircle size={16} color="#d97706" />
              <Text style={{ fontSize: 13, color: '#92400e', flex: 1 }}>
                Apenas administradores podem alterar configurações da empresa e gerenciar usuários.
              </Text>
            </View>
          )}

          {/* Menu Principal */}
          {activeSection === 'menu' && (
            <View style={{ gap: 4 }}>
              <TouchableOpacity
                onPress={() => setActiveSection('empresa')}
                style={[styles.menuCard, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}
              >
                <View style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)' }]}>
                  <Building2 size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuCardTitle, { color: colors.textHeader }]}>Dados da Empresa</Text>
                  <Text style={[styles.menuCardDesc, { color: isDark ? colors.textSecondary : '#64748b' }]}>
                    Razão social, CNPJ, telefone de contato e endereço principal.
                  </Text>
                </View>
                <ChevronRight size={20} color={isDark ? colors.textSecondary : '#94a3b8'} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveSection('pix')}
                style={[styles.menuCard, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}
              >
                <View style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)' }]}>
                  <Banknote size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuCardTitle, { color: colors.textHeader }]}>Integração Pix</Text>
                  <Text style={[styles.menuCardDesc, { color: isDark ? colors.textSecondary : '#64748b' }]}>
                    Chaves Pix e credenciais de API para detecção automática de pagamentos.
                  </Text>
                </View>
                <ChevronRight size={20} color={isDark ? colors.textSecondary : '#94a3b8'} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveSection('pdv')}
                style={[styles.menuCard, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}
              >
                <View style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)' }]}>
                  <Printer size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuCardTitle, { color: colors.textHeader }]}>Configurações de Impressão</Text>
                  <Text style={[styles.menuCardDesc, { color: isDark ? colors.textSecondary : '#64748b' }]}>
                    Impressora padrão, recibo automático, tamanho de etiquetas de produto e alertas.
                  </Text>
                </View>
                <ChevronRight size={20} color={isDark ? colors.textSecondary : '#94a3b8'} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/funcionarios')}
                style={[styles.menuCard, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}
              >
                <View style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)' }]}>
                  <UserCog size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuCardTitle, { color: colors.textHeader }]}>Funcionários</Text>
                  <Text style={[styles.menuCardDesc, { color: isDark ? colors.textSecondary : '#64748b' }]}>
                    Gerencie os usuários do sistema, senhas e níveis de acesso (Admin/Operador).
                  </Text>
                </View>
                <ChevronRight size={20} color={isDark ? colors.textSecondary : '#94a3b8'} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveSection('sistema')}
                style={[styles.menuCard, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}
              >
                <View style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)' }]}>
                  <Smartphone size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuCardTitle, { color: colors.textHeader }]}>Sistema e Licença</Text>
                  <Text style={[styles.menuCardDesc, { color: isDark ? colors.textSecondary : '#64748b' }]}>
                    Status da licença ativa, versão do aplicativo e dados da conta atual.
                  </Text>
                </View>
                <ChevronRight size={20} color={isDark ? colors.textSecondary : '#94a3b8'} />
              </TouchableOpacity>
            </View>
          )}

          {/* Dados da Empresa */}
          {activeSection === 'empresa' && (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Building2 size={18} color={colors.accent} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>Dados da Empresa</Text>
              </View>
              <View style={[styles.card, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
                <Text style={labelStyle}>Razão Social / Nome Fantasia *</Text>
                <TextInput value={razaoSocial} onChangeText={setRazaoSocial} placeholder="Nome da empresa" placeholderTextColor={isDark ? '#475569' : '#94a3b8'} style={inputStyle} editable={isAdmin} />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>CNPJ</Text>
                    <TextInput value={cnpj} onChangeText={(v) => setCnpj(formatarCNPJ(v))} placeholder="00.000.000/0000-00" keyboardType="numeric" placeholderTextColor={isDark ? '#475569' : '#94a3b8'} style={inputStyle} editable={isAdmin} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Telefone</Text>
                    <TextInput value={telefone} onChangeText={setTelefone} placeholder="(00) 00000-0000" keyboardType="phone-pad" placeholderTextColor={isDark ? '#475569' : '#94a3b8'} style={inputStyle} editable={isAdmin} />
                  </View>
                </View>

                <Text style={labelStyle}>Endereço</Text>
                <TextInput value={endereco} onChangeText={setEndereco} placeholder="Av. Principal, 1000 - Centro" placeholderTextColor={isDark ? '#475569' : '#94a3b8'} style={inputStyle} editable={isAdmin} />
              </View>
            </View>
          )}

          {/* Integração Pix */}
          {activeSection === 'pix' && (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Banknote size={18} color={colors.accent} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>Integração Pix</Text>
              </View>
              <View style={[styles.card, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
                {/* Info sobre detecção automática */}
                <View style={{ flexDirection: 'row', gap: 8, backgroundColor: '#f0fdf4', borderRadius: 8, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: '#bbf7d0' }}>
                  <Zap size={14} color="#16a34a" />
                  <Text style={{ fontSize: 12, color: '#15803d', flex: 1, lineHeight: 18 }}>
                    Com o <Text style={{ fontWeight: 'bold' }}>Token de API</Text> configurado, o sistema detecta automaticamente o pagamento Pix recebido e emite o cupom sem precisar confirmar manualmente.
                  </Text>
                </View>

                {/* Chave Pix e Titular */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Chave Pix</Text>
                    <TextInput value={pixChave} onChangeText={setPixChave} placeholder="CPF, CNPJ, email ou aleatória" placeholderTextColor={isDark ? '#475569' : '#94a3b8'} style={inputStyle} editable={isAdmin} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Nome do Titular</Text>
                    <TextInput value={pixTitular} onChangeText={setPixTitular} placeholder="Ex: Loja Conecta" placeholderTextColor={isDark ? '#475569' : '#94a3b8'} style={inputStyle} editable={isAdmin} />
                  </View>
                </View>

                {/* Separador API */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 4 }}>
                  <KeyRound size={14} color={colors.accent} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent, letterSpacing: 0.5 }}>API BANCÁRIA (DETECÇÃO AUTOMÁTICA)</Text>
                </View>
                <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 6 }} />

                {/* Provedor */}
                <Text style={labelStyle}>Provedor / Banco</Text>
                <TextInput
                  value={apiProvedor}
                  onChangeText={setApiProvedor}
                  placeholder="Ex: Mercado Pago, EFI Bank, PagSeguro..."
                  placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                  style={inputStyle}
                  editable={isAdmin}
                />

                {/* Token e Secret lado a lado */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Token de Acesso (API)</Text>
                    <TextInput
                      value={apiToken}
                      onChangeText={setApiToken}
                      placeholder="Bearer token ou Access Key"
                      placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                      style={inputStyle}
                      editable={isAdmin}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Client Secret</Text>
                    <TextInput
                      value={apiSecret}
                      onChangeText={setApiSecret}
                      placeholder="Client Secret / Webhook Key"
                      placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                      style={inputStyle}
                      editable={isAdmin}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                {/* Status da integração */}
                <View style={{
                  marginTop: 14, padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: apiToken.trim() ? '#f0fdf4' : (isDark ? '#1e293b' : '#f8fafc'),
                  borderWidth: 1,
                  borderColor: apiToken.trim() ? '#bbf7d0' : colors.border,
                }}>
                  <Zap size={14} color={apiToken.trim() ? '#16a34a' : '#94a3b8'} />
                  <Text style={{ fontSize: 12, color: apiToken.trim() ? '#15803d' : colors.textSecondary }}>
                    {apiToken.trim()
                      ? `Detecção automática ATIVA — ${apiProvedor.trim() || 'Provedor configurado'}`
                      : 'Detecção automática INATIVA — configure o Token para habilitar'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Configurações de Impressão */}
          {activeSection === 'pdv' && (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Printer size={18} color={colors.accent} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>Configurações de Impressão</Text>
              </View>
              <View style={[styles.card, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
                <Text style={labelStyle}>Impressora Padrão</Text>
                <TextInput value={impressoraPadrao} onChangeText={setImpressoraPadrao} placeholder="Ex: Impressora Térmica USB" placeholderTextColor={isDark ? '#475569' : '#94a3b8'} style={inputStyle} editable={isAdmin} />

                <View style={styles.switchRow}>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textHeader }}>Impressão Automática</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Imprimir recibo ao finalizar venda</Text>
                  </View>
                  <Switch value={imprimirAutomatico} onValueChange={setImprimirAutomatico} trackColor={{ false: '#94a3b8', true: colors.accent }} disabled={!isAdmin} />
                </View>

                <View style={styles.switchRow}>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textHeader }}>Sons de Alerta</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Tocar sons em ações</Text>
                  </View>
                  <Switch value={somAviso} onValueChange={setSomAviso} trackColor={{ false: '#94a3b8', true: colors.accent }} disabled={!isAdmin} />
                </View>

                {/* Separador Etiquetas */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 4 }}>
                  <Printer size={14} color={colors.accent} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent, letterSpacing: 0.5 }}>ETIQUETAS DE PRODUTO (WEB)</Text>
                </View>
                <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 6 }} />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Largura (mm)</Text>
                    <TextInput
                      value={etiquetaLargura}
                      onChangeText={setEtiquetaLargura}
                      placeholder="Ex: 50"
                      keyboardType="numeric"
                      placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                      style={inputStyle}
                      editable={isAdmin}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Altura (mm)</Text>
                    <TextInput
                      value={etiquetaAltura}
                      onChangeText={setEtiquetaAltura}
                      placeholder="Ex: 30"
                      keyboardType="numeric"
                      placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                      style={inputStyle}
                      editable={isAdmin}
                    />
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Sistema */}
          {activeSection === 'sistema' && (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Smartphone size={18} color={colors.accent} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>Sistema e Licença</Text>
              </View>
              <View style={[styles.card, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <ShieldCheck size={24} color="#10b981" />
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.textHeader }}>Licença Ativa</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>Plano Pro — Expira em 31/12/2026</Text>
                  </View>
                </View>
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 10 }} />
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>Versão: 2.1.0</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>Usuário: {authState.usuario?.nome} ({authState.usuario?.perfil})</Text>
              </View>
            </View>
          )}

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 4 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.35)',
    marginTop: 6,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 16,
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  menuCardDesc: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
});
