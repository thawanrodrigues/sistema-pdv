import { Slot, usePathname, useRouter } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../ui/themes/index.theme';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { getDB } from '../database/db';
import { authStore } from '../store/authStore';
import { produtosStore } from '../store/produtosStore';
import { caixaStore } from '../store/caixaStore';
import '../../global.css';

export default function RootLayout() {
  const { colors } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [inicializado, setInicializado] = useState(false);

  const authState = useSyncExternalStore(authStore.subscribe, authStore.getState);

  const isAuthRoute = pathname === '/login' || pathname === '/register';

  // Inicializa banco e sessão ao montar
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // 1. Inicializar o banco (cria tabelas + admin padrão)
        await getDB();
        // 2. Recuperar sessão salva
        authStore.init();
        // 3. Carregar produtos e estado do caixa
        await Promise.all([
          produtosStore.carregar(),
          caixaStore.init(),
        ]);
      } catch (e) {
        console.error('Erro ao inicializar sistema:', e);
      } finally {
        if (mounted) setInicializado(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Guard de rota: redireciona para login se não autenticado
  useEffect(() => {
    if (!inicializado) return;
    if (!isAuthRoute && !authState.usuario) {
      router.replace('/login');
      return;
    }
    // Guard de perfil: funcionários só podem acessar o terminal
    if (!isAuthRoute && authState.usuario?.perfil === 'funcionario') {
      const rotasPermitidas = ['/terminal'];
      const rotaPermitida = rotasPermitidas.some((r) => pathname === r || pathname.startsWith(r));
      if (!rotaPermitida) {
        router.replace('/terminal');
      }
    }
  }, [inicializado, authState.usuario, isAuthRoute, pathname]);

  // Tela de loading enquanto inicializa
  if (!inicializado) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <Text style={{ fontSize: 28, fontWeight: '900', color: '#ffffff', letterSpacing: -0.5 }}>
          CONECTA SISTEMAS
        </Text>
        <Text style={{ fontSize: 13, color: '#f59e0b', fontWeight: '700', letterSpacing: 1 }}>
          SOLUÇÕES PARA SUA EMPRESA
        </Text>
        <ActivityIndicator size="large" color="#f59e0b" style={{ marginTop: 20 }} />
        <Text style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>
          Inicializando banco de dados...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {!isAuthRoute && <TopBar />}
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
      {!isAuthRoute && (
        <View style={{
          backgroundColor: colors.headerBackground,
          paddingVertical: 5,
          borderTopWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
        }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
            Conecta Sistemas PDV | v2.1.0 — {authState.usuario?.nome} ({authState.usuario?.perfil})
          </Text>
        </View>
      )}
    </View>
  );
}
