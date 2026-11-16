// ============================================================
// Cliente HTTP para a API SaaS Multi-Tenant (PostgreSQL)
// ============================================================

import { Platform } from 'react-native';

const TOKEN_KEY = 'conecta_pdv_token_v1';
const USER_KEY = 'conecta_pdv_user_v1';

export function getApiBaseUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // No navegador, usa a mesma origem do domínio atual (ex: https://app7.conectasistemas.sbs)
    return `${window.location.origin}/api`;
  }
  return 'https://app7.conectasistemas.sbs/api';
}

export function getToken(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(TOKEN_KEY);
    }
  } catch {}
  return null;
}

export function setToken(token: string | null): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
  } catch {}
}

export function getSavedUser(): any | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const u = localStorage.getItem(USER_KEY);
      return u ? JSON.parse(u) : null;
    }
  } catch {}
  return null;
}

export function setSavedUser(user: any | null): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(USER_KEY);
      }
    }
  } catch {}
}

export async function requestApi<T = any>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
    headers?: Record<string, string>;
  } = {}
): Promise<{ ok: boolean; status: number; data?: T; erro?: string }> {
  try {
    const baseUrl = getApiBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${baseUrl}${cleanEndpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        erro: data?.erro || data?.message || `Erro HTTP ${response.status}`,
      };
    }

    return { ok: true, status: response.status, data };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      erro: err.message || 'Falha ao conectar com o servidor.',
    };
  }
}
