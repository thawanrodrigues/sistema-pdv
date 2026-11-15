import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Lock, User, ChevronRight, AlertCircle } from 'lucide-react-native';
import { authStore } from '../store/authStore';

export default function LoginScreen() {
  const router = useRouter();

  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setErro('');

    // Validações básicas
    if (!usuario.trim()) {
      setErro('Informe o nome de usuário.');
      return;
    }
    if (senha.length < 4) {
      setErro('Senha deve ter no mínimo 4 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const result = await authStore.login(usuario.trim(), senha);
      if (!result.ok) {
        setErro(result.msg);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View entering={FadeInUp.duration(700)} style={styles.headerContainer}>
            <Text style={styles.logoText}>CONECTA</Text>
            <Text style={styles.logoBold}>SISTEMAS</Text>
            <Text style={styles.subtitleText}>SOLUÇÕES PARA SUA EMPRESA!</Text>
          </Animated.View>

          {/* Card */}
          <Animated.View entering={FadeInDown.delay(200).duration(700)} style={styles.card}>
            <Text style={styles.cardTitle}>Acesse sua conta</Text>
            <Text style={styles.cardSubtitle}>Informe seu usuário e senha para continuar</Text>

            {/* Erro */}
            {!!erro && (
              <View style={styles.errorBox}>
                <AlertCircle size={16} color="#ef4444" />
                <Text style={styles.errorText}>{erro}</Text>
              </View>
            )}

            {/* Usuário */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Usuário</Text>
              <View style={[styles.inputContainer, !!erro && usuario === '' && styles.inputError]}>
                <User size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  value={usuario}
                  onChangeText={(t) => { setUsuario(t); setErro(''); }}
                  placeholder="Ex: admin"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  onSubmitEditing={handleLogin}
                />
              </View>
            </View>

            {/* Senha */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Senha</Text>
              <View style={styles.inputContainer}>
                <Lock size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  value={senha}
                  onChangeText={(t) => { setSenha(t); setErro(''); }}
                  placeholder="••••••"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry
                  style={styles.input}
                  onSubmitEditing={handleLogin}
                />
              </View>
            </View>

            {/* Botão Login */}
            <TouchableOpacity
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={loading}
              style={[styles.loginButton, loading && { opacity: 0.7 }]}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Entrar</Text>
                  <ChevronRight size={20} color="#ffffff" />
                </>
              )}
            </TouchableOpacity>

            {/* Link Registro */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Nova empresa? </Text>
              <TouchableOpacity onPress={() => router.push('/register')} activeOpacity={0.7}>
                <Text style={styles.registerLink}>Cadastrar empresa</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    paddingVertical: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoText: {
    fontSize: 44,
    fontWeight: '300',
    color: '#ffffff',
    letterSpacing: 8,
    lineHeight: 48,
  },
  logoBold: {
    fontSize: 44,
    fontWeight: '900',
    color: '#f59e0b',
    letterSpacing: 4,
    lineHeight: 48,
  },
  subtitleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 2,
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 20 },
      android: { elevation: 12 },
      web: { boxShadow: '0 20px 50px rgba(0,0,0,0.35)' },
    }),
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '500',
  },
  inputGroup: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    height: '100%',
    ...Platform.select({ web: { outlineStyle: 'none' as any } }),
  },
  loginButton: {
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    borderRadius: 12,
    marginTop: 8,
    ...Platform.select({
      web: { boxShadow: '0 4px 15px rgba(245,158,11,0.5)' },
    }),
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  hintBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  hintText: {
    fontSize: 12,
    color: '#15803d',
    textAlign: 'center',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  registerText: { fontSize: 13, color: '#64748b' },
  registerLink: { fontSize: 13, fontWeight: 'bold', color: '#f59e0b' },
});
