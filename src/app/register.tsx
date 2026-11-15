import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  User,
  Building2,
  Lock,
  Mail,
  X,
  CheckCircle2,
  AlertCircle,
  Phone,
  MapPin,
  FileText,
} from 'lucide-react-native';
import { primeiroAcesso } from '../database/authRepository';
import { validarEmail, validarCNPJ, formatarCNPJ, validarSenha, validarUsuario } from '../utils/validation';

export default function RegisterScreen() {
  const router = useRouter();

  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');

  const [nome, setNome] = useState('');
  const [usuario, setUsuario] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');

  const [erros, setErros] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const validar = (): boolean => {
    const e: Record<string, string> = {};

    if (!nomeEmpresa.trim() || nomeEmpresa.trim().length < 2)
      e.nomeEmpresa = 'Nome da empresa obrigatório.';

    if (cnpj.trim() && !validarCNPJ(cnpj))
      e.cnpj = 'CNPJ inválido.';

    if (!nome.trim() || nome.trim().length < 2)
      e.nome = 'Nome completo obrigatório.';

    const uVal = validarUsuario(usuario);
    if (!uVal.ok) e.usuario = uVal.msg;

    if (email.trim() && !validarEmail(email))
      e.email = 'E-mail inválido.';

    const sVal = validarSenha(senha);
    if (!sVal.ok) e.senha = sVal.msg;

    if (senha !== confirmaSenha) e.confirmaSenha = 'As senhas não coincidem.';

    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    setErro('');
    if (!validar()) return;

    setLoading(true);
    try {
      const result = await primeiroAcesso({
        nomeEmpresa: nomeEmpresa.trim(),
        cnpj: cnpj.trim(),
        telefone: telefone.trim(),
        endereco: endereco.trim(),
        nome: nome.trim(),
        usuario: usuario.trim().toLowerCase(),
        email: email.trim(),
        senha,
      });

      if (!result.ok) {
        setErro(result.msg);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (campo: string, hasIcon = true) => ({
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: erros[campo] ? '#ef4444' : '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 9 : 7,
    color: '#0f172a',
    fontSize: 13,
    height: 38,
    paddingLeft: hasIcon ? 34 : 10,
    ...Platform.select({ web: { outlineStyle: 'none' as any } }),
  });

  const FieldError = ({ campo }: { campo: string }) =>
    erros[campo] ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
        <AlertCircle size={11} color="#ef4444" />
        <Text style={{ fontSize: 10, color: '#ef4444' }}>{erros[campo]}</Text>
      </View>
    ) : null;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', alignItems: 'center' }}>
          
          <Animated.View entering={FadeInDown.duration(400)} style={styles.dialog}>
            
            {/* Header do Dialog */}
            <View style={styles.dialogHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dialogTitle}>Cadastro da Empresa</Text>
                <Text style={styles.dialogSubtitle}>Preencha os dados para inicializar o sistema</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.closeBtn}
                activeOpacity={0.7}
              >
                <X size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            {!!erro && (
              <View style={styles.errorAlert}>
                <AlertCircle size={15} color="#ef4444" />
                <Text style={{ flex: 1, color: '#ef4444', fontSize: 12 }}>{erro}</Text>
              </View>
            )}

            {/* Seção 1: Dados da Empresa */}
            <View style={styles.sectionHeader}>
              <Building2 size={15} color="#f59e0b" />
              <Text style={styles.sectionTitle}>Dados da Empresa</Text>
            </View>

            <Text style={styles.label}>Nome Fantasia / Razão Social *</Text>
            <View style={{ justifyContent: 'center' }}>
              <Building2 size={14} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                value={nomeEmpresa}
                onChangeText={setNomeEmpresa}
                placeholder="Ex: Minha Loja Ltda"
                placeholderTextColor="#94a3b8"
                style={inputStyle('nomeEmpresa', true)}
              />
            </View>
            <FieldError campo="nomeEmpresa" />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>CNPJ</Text>
                <View style={{ justifyContent: 'center' }}>
                  <FileText size={14} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    value={cnpj}
                    onChangeText={(v) => setCnpj(formatarCNPJ(v))}
                    placeholder="00.000.000/0000-00"
                    keyboardType="numeric"
                    placeholderTextColor="#94a3b8"
                    style={inputStyle('cnpj', true)}
                  />
                </View>
                <FieldError campo="cnpj" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Telefone</Text>
                <View style={{ justifyContent: 'center' }}>
                  <Phone size={14} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    value={telefone}
                    onChangeText={setTelefone}
                    placeholder="(00) 00000-0000"
                    keyboardType="phone-pad"
                    placeholderTextColor="#94a3b8"
                    style={inputStyle('telefone', true)}
                  />
                </View>
              </View>
            </View>

            <Text style={[styles.label, { marginTop: 8 }]}>Endereço</Text>
            <View style={{ justifyContent: 'center' }}>
              <MapPin size={14} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                value={endereco}
                onChangeText={setEndereco}
                placeholder="Av. Principal, 1000 - Centro"
                placeholderTextColor="#94a3b8"
                style={inputStyle('endereco', true)}
              />
            </View>

            {/* Linha Divisória */}
            <View style={styles.divider} />

            {/* Seção 2: Usuário Administrador */}
            <View style={styles.sectionHeader}>
              <User size={15} color="#f59e0b" />
              <Text style={styles.sectionTitle}>Usuário Administrador</Text>
            </View>

            <Text style={styles.label}>Nome Completo *</Text>
            <View style={{ justifyContent: 'center' }}>
              <User size={14} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                value={nome}
                onChangeText={setNome}
                placeholder="Ex: João da Silva"
                placeholderTextColor="#94a3b8"
                style={inputStyle('nome', true)}
              />
            </View>
            <FieldError campo="nome" />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Usuário (login) *</Text>
                <TextInput
                  value={usuario}
                  onChangeText={(t) => setUsuario(t.toLowerCase().replace(/\s/g, ''))}
                  placeholder="joao.admin"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#94a3b8"
                  style={inputStyle('usuario', false)}
                />
                <FieldError campo="usuario" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>E-mail</Text>
                <View style={{ justifyContent: 'center' }}>
                  <Mail size={14} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="joao@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor="#94a3b8"
                    style={inputStyle('email', true)}
                  />
                </View>
                <FieldError campo="email" />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Senha *</Text>
                <View style={{ justifyContent: 'center' }}>
                  <Lock size={14} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    value={senha}
                    onChangeText={setSenha}
                    placeholder="Mín. 6 dígitos"
                    secureTextEntry
                    placeholderTextColor="#94a3b8"
                    style={inputStyle('senha', true)}
                  />
                </View>
                <FieldError campo="senha" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Confirmar Senha *</Text>
                <View style={{ justifyContent: 'center' }}>
                  <Lock size={14} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    value={confirmaSenha}
                    onChangeText={setConfirmaSenha}
                    placeholder="Repita a senha"
                    secureTextEntry
                    placeholderTextColor="#94a3b8"
                    style={inputStyle('confirmaSenha', true)}
                  />
                </View>
                <FieldError campo="confirmaSenha" />
              </View>
            </View>

            {/* Botão de Submissão */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
              style={[styles.btn, loading && { opacity: 0.7 }]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.btnText}>Finalizar Cadastro</Text>
                  <CheckCircle2 size={17} color="#fff" />
                </>
              )}
            </TouchableOpacity>

          </Animated.View>
        </KeyboardAvoidingView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1329',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    paddingVertical: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 520, // Dialog pequeno e compacto
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 45px rgba(0, 0, 0, 0.45), 0 4px 10px rgba(0, 0, 0, 0.2)',
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: { elevation: 12 },
    }),
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  dialogSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  label: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 3,
    marginTop: 6,
  },
  inputIcon: {
    position: 'absolute',
    left: 10,
    zIndex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14,
  },
  btn: {
    backgroundColor: '#f59e0b',
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)' },
    }),
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
