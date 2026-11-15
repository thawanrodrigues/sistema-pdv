import { Platform } from 'react-native';

export type ConfigState = {
  pixChave: string;
  pixTitular: string;
  apiProvedor: string;
  apiToken: string;
  apiSecret: string;
  
  // Configurações de Impressão
  impressoraPadrao: string;
  imprimirAutomatico: boolean;
  somAviso: boolean;
  etiquetaLargura: number;
  etiquetaAltura: number;
};

const IS_WEB = Platform.OS === 'web' && typeof window !== 'undefined' && typeof localStorage !== 'undefined';

const DEFAULT_STATE: ConfigState = {
  pixChave: '',
  pixTitular: '',
  apiProvedor: 'Mercado Pago',
  apiToken: '',
  apiSecret: '',
  impressoraPadrao: 'Impressora Térmica 80mm',
  imprimirAutomatico: true,
  somAviso: true,
  etiquetaLargura: 50,
  etiquetaAltura: 30,
};

let state: ConfigState = { ...DEFAULT_STATE };

if (IS_WEB) {
  try {
    const savedImpressora = localStorage.getItem('cfg_impressoraPadrao');
    const savedImprimirAuto = localStorage.getItem('cfg_imprimirAutomatico');
    const savedSomAviso = localStorage.getItem('cfg_somAviso');
    const savedEtiquetaLargura = localStorage.getItem('cfg_etiquetaLargura');
    const savedEtiquetaAltura = localStorage.getItem('cfg_etiquetaAltura');

    if (savedImpressora !== null) state.impressoraPadrao = savedImpressora;
    if (savedImprimirAuto !== null) state.imprimirAutomatico = savedImprimirAuto === 'true';
    if (savedSomAviso !== null) state.somAviso = savedSomAviso === 'true';
    if (savedEtiquetaLargura !== null) state.etiquetaLargura = parseInt(savedEtiquetaLargura, 10) || 50;
    if (savedEtiquetaAltura !== null) state.etiquetaAltura = parseInt(savedEtiquetaAltura, 10) || 30;
  } catch (e) {
    console.error('Erro ao ler localStorage', e);
  }
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export const configStore = {
  getState: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setConfig: (newConfig: Partial<ConfigState>) => {
    state = { ...state, ...newConfig };
    if (IS_WEB) {
      try {
        if (newConfig.impressoraPadrao !== undefined) localStorage.setItem('cfg_impressoraPadrao', newConfig.impressoraPadrao);
        if (newConfig.imprimirAutomatico !== undefined) localStorage.setItem('cfg_imprimirAutomatico', String(newConfig.imprimirAutomatico));
        if (newConfig.somAviso !== undefined) localStorage.setItem('cfg_somAviso', String(newConfig.somAviso));
        if (newConfig.etiquetaLargura !== undefined) localStorage.setItem('cfg_etiquetaLargura', String(newConfig.etiquetaLargura));
        if (newConfig.etiquetaAltura !== undefined) localStorage.setItem('cfg_etiquetaAltura', String(newConfig.etiquetaAltura));
      } catch (e) {
        console.error('Erro ao salvar no localStorage', e);
      }
    }
    notify();
  },
};
