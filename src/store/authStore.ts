// ============================================================
// Auth Store — Autenticação real com SQLite + sessão persistida
// ============================================================
import { Platform } from 'react-native';
import { autenticar, type Usuario } from '../database/authRepository';

export type AuthState = {
  usuario: Usuario | null;
  loading: boolean;
};

const SESSION_KEY = 'pdv_session_usuario';

let state: AuthState = {
  usuario: null,
  loading: false,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function setState(next: Partial<AuthState>) {
  state = { ...state, ...next };
  notify();
}

/** Persiste o usuário logado na sessão do browser/AsyncStorage */
function salvarSessao(usuario: Usuario | null) {
  try {
    if (Platform.OS === 'web') {
      if (usuario) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(usuario));
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  } catch {
    // silenciar erros de storage
  }
}

/** Recupera sessão salva */
function recuperarSessao(): Usuario | null {
  try {
    if (Platform.OS === 'web') {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) return JSON.parse(raw) as Usuario;
    }
  } catch {
    // silenciar
  }
  return null;
}

export const authStore = {
  getState: () => state,

  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Inicializa o store — recupera sessão se houver */
  init: () => {
    const usuario = recuperarSessao();
    if (usuario) {
      setState({ usuario, loading: false });
    }
  },

  /** Faz login verificando no banco */
  login: async (usuario: string, senha: string): Promise<{ ok: boolean; msg: string }> => {
    setState({ loading: true });
    try {
      const user = await autenticar(usuario, senha);
      if (!user) {
        setState({ loading: false });
        return { ok: false, msg: 'Usuário ou senha incorretos.' };
      }
      if (!user.ativo) {
        setState({ loading: false });
        return { ok: false, msg: 'Usuário desativado. Contate o administrador.' };
      }
      salvarSessao(user);
      setState({ usuario: user, loading: false });
      return { ok: true, msg: 'Login realizado com sucesso.' };
    } catch (e: any) {
      setState({ loading: false });
      return { ok: false, msg: e.message || 'Erro ao autenticar.' };
    }
  },

  /** Encerra a sessão */
  logout: () => {
    salvarSessao(null);
    setState({ usuario: null, loading: false });
  },

  /** Retorna se o usuário logado é admin */
  isAdmin: () => state.usuario?.perfil === 'admin',

  /** Retorna o usuário atual */
  getUsuario: () => state.usuario,

  /** Verifica se está autenticado */
  isAutenticado: () => state.usuario !== null,
};
