import React, { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  StyleSheet,
  Modal,
  Pressable
} from 'react-native';
import { useTheme } from '../ui/themes/index.theme';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Minus, Plus, ShoppingCart, Trash2, Search, ScanBarcode, CreditCard, Banknote, QrCode, X, Printer, RotateCcw } from 'lucide-react-native';
import { authStore } from '../store/authStore';
import { caixaStore } from '../store/caixaStore';
import { produtosStore, ProdutoCadastro } from '../store/produtosStore';
import { receberStore } from '../store/receberStore';
import { configStore } from '../store/configStore';
import { registrarVenda } from '../database/vendaRepository';
import QRCode from 'react-native-qrcode-svg';
import { generatePixPayload } from '../utils/pix';
import { useEffect } from 'react';
import { registrarNotaFiscal, obterConfigFiscal } from '../database/notaFiscalRepository';
import { getEmpresa } from '../database/authRepository';
import { gerarXMLNFCe } from '../utils/xmlGenerator';
import { gerarXMLNfse } from '../utils/xmlGeneratorNfse';
import { ActivityIndicator } from 'react-native';
import { validarCpfCnpj } from '../utils/validators';
import { verificarSenha } from '../utils/crypto';
import { getDB } from '../database/db';
import { transmitirParaSefaz } from '../services/sefazService';

type ItemCarrinho = {
  key: string;
  idCatalogo: string;
  nome: string;
  qtd: number;
  precoUnit: number;
};

function formatMoney(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalizar(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export default function TerminalScreen() {
  const { colors, isDark } = useTheme();
  const caixaStatus = useSyncExternalStore(caixaStore.subscribe, () => caixaStore.getState().status);
  const CATALOGO = useSyncExternalStore(produtosStore.subscribe, produtosStore.getState);
  const [buscaGeral, setBuscaGeral] = useState('');
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [nomeAvulso, setNomeAvulso] = useState('');
  const [precoAvulso, setPrecoAvulso] = useState('');
  const [qtdAvulso, setQtdAvulso] = useState('1');
  const [valorRecebidoRaw, setValorRecebidoRaw] = useState('');
  const [cpfCnpjCliente, setCpfCnpjCliente] = useState('');


  // Modais e Estados de Venda
  const [modalPagamentoVisible, setModalPagamentoVisible] = useState(false);
  const [modalReciboVisible, setModalReciboVisible] = useState(false);
  const [metodoPago, setMetodoPago] = useState('');
  const [modalCancelVisible, setModalCancelVisible] = useState(false);
  const [modalPixQrcodeVisible, setModalPixQrcodeVisible] = useState(false);
  const [modalCpfVisible, setModalCpfVisible] = useState(false);
  const [timerAtivo, setTimerAtivo] = useState(false);
  const [cancelBusca, setCancelBusca] = useState('');
  const [cancelSenha, setCancelSenha] = useState('');

  const configState = useSyncExternalStore(
    configStore.subscribe,
    configStore.getState,
    configStore.getState
  );

  // Estados para Emissão de Notas Fiscais
  const [ultimaVendaId, setUltimaVendaId] = useState<number | null>(null);
  const [emissaoStatus, setEmissaoStatus] = useState<'idle' | 'gerando' | 'transmitindo' | 'autorizada' | 'erro'>('idle');
  const [chaveAcessoEmitida, setChaveAcessoEmitida] = useState('');
  const [protocoloEmitido, setProtocoloEmitido] = useState('');
  const [numeroNotaEmitido, setNumeroNotaEmitido] = useState(0);
  const [serieNotaEmitida, setSerieNotaEmitida] = useState(0);
  const [danfeModalVisible, setDanfeModalVisible] = useState(false);
  const [empresaDados, setEmpresaDados] = useState<any>(null);
  const [tipoEmitido, setTipoEmitido] = useState<'NFC-e' | 'NFS-e'>('NFC-e');
  const [valorIssEmitido, setValorIssEmitido] = useState(0);
  const [aliquotaIssEmitida, setAliquotaIssEmitida] = useState(0);
  const [inscricaoMunicipalEmitida, setInscricaoMunicipalEmitida] = useState('');

  const fieldColor = colors.textHeader;
  const placeholderColor = isDark ? 'rgba(148, 163, 184, 0.85)' : '#94a3b8';

  const borderDiscreto = isDark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(100, 116, 139, 0.28)';

  const searchInner = {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 5 : 4,
    paddingHorizontal: 6,
    fontSize: 14,
    color: '#0f172a', // Texto escuro para contrastar com o fundo branco
  };

  const subtotal = useMemo(
    () => carrinho.reduce((acc, it) => acc + it.qtd * it.precoUnit, 0),
    [carrinho]
  );

  const pixPayloadStr = useMemo(() => {
    if (!modalPixQrcodeVisible) return '';
    return generatePixPayload(
      configState.pixChave,
      configState.pixTitular,
      'Cidade',
      subtotal,
      `VND${Date.now().toString().substring(8)}`
    );
  }, [configState.pixChave, configState.pixTitular, subtotal, modalPixQrcodeVisible]);

  const valorRecebido = useMemo(() => {
    const t = valorRecebidoRaw.trim();
    if (!t) return 0;
    const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
    const n = parseFloat(normalized) || 0;
    return Math.round(n * 100) / 100;
  }, [valorRecebidoRaw]);

  const troco = useMemo(() => {
    return valorRecebido > subtotal ? valorRecebido - subtotal : 0;
  }, [valorRecebido, subtotal]);

  const filtrados = useMemo(() => {
    const q = normalizar(buscaGeral);
    if (!q) return [];
    return CATALOGO.filter((p) => {
      const nomeOk = normalizar(p.nome).includes(q);
      const codOk = p.codigo.toLowerCase().includes(buscaGeral.trim().toLowerCase());
      return nomeOk || codOk;
    });
  }, [buscaGeral, CATALOGO]);

  const limparBuscas = useCallback(() => {
    setBuscaGeral('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const addDoCatalogo = useCallback((item: ProdutoCadastro) => {
    setCarrinho((lista) => {
      const idx = lista.findIndex((l) => l.idCatalogo === item.id && l.precoUnit === item.precoVenda);
      if (idx >= 0) {
        const next = [...lista];
        next[idx] = { ...next[idx], qtd: next[idx].qtd + 1 };
        return next;
      }
      return [
        ...lista,
        {
          key: `${item.id}-${Date.now()}`,
          idCatalogo: item.id,
          nome: item.nome,
          qtd: 1,
          precoUnit: item.precoVenda,
        },
      ];
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const resolverCodigoBarras = useCallback(() => {
    const q = buscaGeral.trim();
    if (!q) {
      if (Platform.OS === 'web') {
        window.alert('Digite ou escaneie o código de barras ou nome do produto.');
      } else {
        Alert.alert('Código', 'Digite ou escaneie o código de barras ou nome do produto.');
      }
      return;
    }
    const exato = CATALOGO.find((p) => p.codigo === q);
    const parcial = CATALOGO.find((p) => p.codigo.startsWith(q) || q.startsWith(p.codigo));
    const item = exato ?? parcial;
    if (item) {
      addDoCatalogo(item);
      setBuscaGeral('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      if (Platform.OS === 'web') {
        window.alert(`Nenhum produto com o código "${q}".`);
      } else {
        Alert.alert('Não encontrado', `Nenhum produto com o código "${q}".`);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  }, [buscaGeral, addDoCatalogo, CATALOGO]);

  const addAvulso = useCallback(() => {
    const nome = nomeAvulso.trim() || 'Item avulso';
    const qtd = Math.max(1, parseInt(qtdAvulso.replace(/\D/g, ''), 10) || 1);
    const pt = precoAvulso.trim();
    const precoNorm = pt.includes(',') ? pt.replace(/\./g, '').replace(',', '.') : pt;
    const precoNum = parseFloat(precoNorm) || 0;
    if (precoNum <= 0) {
      if (Platform.OS === 'web') {
        window.alert('Informe um preço válido.');
      } else {
        Alert.alert('Validação', 'Informe um preço válido.');
      }
      return;
    }
    setCarrinho((lista) => [
      ...lista,
      {
        key: `avulso-${Date.now()}`,
        idCatalogo: 'avulso',
        nome,
        qtd,
        precoUnit: precoNum,
      },
    ]);
    setNomeAvulso('');
    setPrecoAvulso('');
    setQtdAvulso('1');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [nomeAvulso, precoAvulso, qtdAvulso]);

  const setQtd = useCallback((key: string, qtd: number) => {
    if (qtd < 1) return;
    setCarrinho((lista) => lista.map((it) => (it.key === key ? { ...it, qtd } : it)));
  }, []);

  const removerLinha = useCallback((key: string) => {
    setCarrinho((lista) => lista.filter((it) => it.key !== key));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const limparCarrinho = useCallback(() => {
    if (carrinho.length === 0) return;
    if (Platform.OS === 'web') {
      const resp = window.confirm('Remover todos os itens do terminal?');
      if (resp) {
        setCarrinho([]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
    } else {
      Alert.alert('Limpar cupom', 'Remover todos os itens do terminal?', [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim',
          style: 'destructive',
          onPress: () => {
            setCarrinho([]);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          },
        },
      ]);
    }
  }, [carrinho.length]);

  const abrirCancelamentoItem = useCallback(() => {
    if (carrinho.length === 0) {
      if (Platform.OS === 'web') {
        window.alert('Nenhum item para cancelar.');
      } else {
        Alert.alert('Atenção', 'Nenhum item para cancelar.');
      }
      return;
    }
    setCancelBusca('');
    setCancelSenha('');
    setModalCancelVisible(true);
  }, [carrinho.length]);

  const confirmarCancelamentoItem = useCallback(async () => {
    const s = cancelSenha.trim();
    if (!s) {
      if (Platform.OS === 'web') window.alert('Informe a senha do administrador.');
      else Alert.alert('Atenção', 'Informe a senha do administrador.');
      return;
    }

    // Verificar senha no banco SQLite
    let senhaValida = false;
    try {
      const db = await getDB();
      const adminRow = await db.getFirstAsync<{ senha_hash: string }>(
        "SELECT senha_hash FROM usuarios WHERE perfil = 'admin' AND ativo = 1 LIMIT 1"
      );
      if (adminRow) {
        senhaValida = await verificarSenha(s, adminRow.senha_hash);
      }
    } catch {
      // fallback seguro: negar
      senhaValida = false;
    }

    if (!senhaValida) {
      if (Platform.OS === 'web') window.alert('Senha de administrador incorreta.');
      else Alert.alert('Acesso Negado', 'Senha de administrador incorreta.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    const q = normalizar(cancelBusca);
    if (!q) {
      if (Platform.OS === 'web') window.alert('Pesquise o item a cancelar.');
      else Alert.alert('Atenção', 'Pesquise o item a cancelar.');
      return;
    }
    const idx = [...carrinho].reverse().findIndex(it => normalizar(it.nome).includes(q) || it.idCatalogo.toLowerCase().includes(q));
    if (idx === -1) {
      if (Platform.OS === 'web') window.alert('Item não encontrado na venda.');
      else Alert.alert('Erro', 'Item não encontrado na venda atual.');
      return;
    }
    const itemToRemove = carrinho[carrinho.length - 1 - idx];
    removerLinha(itemToRemove.key);
    setModalCancelVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [cancelBusca, cancelSenha, carrinho, removerLinha]);

  const finalizar = useCallback(() => {
    if (carrinho.length === 0) {
      if (Platform.OS === 'web') {
        window.alert('Adicione itens antes de finalizar.');
      } else {
        Alert.alert('Cupom vazio', 'Adicione itens antes de finalizar.');
      }
      return;
    }
    const { status } = caixaStore.getState();
    if (status === 'fechado') {
      if (Platform.OS === 'web') {
        window.alert('O caixa está fechado. Abra o caixa primeiro para poder realizar vendas.');
      } else {
        Alert.alert('Caixa Fechado', 'O caixa está fechado. Abra o caixa primeiro.');
      }
      return;
    }
    setModalPagamentoVisible(true);
  }, [carrinho.length]);

  const abrirModalCpf = useCallback(() => {
    setModalCpfVisible(true);
  }, []);

  const confirmarCpfCnpj = useCallback(() => {
    const doc = cpfCnpjCliente.trim();
    if (doc && !validarCpfCnpj(doc)) {
      if (Platform.OS === 'web') window.alert('CPF/CNPJ inválido.');
      else Alert.alert('Validação', 'CPF/CNPJ com formato inválido.');
      return;
    }
    setModalCpfVisible(false);
  }, [cpfCnpjCliente]);

  const confirmarVendaReal = useCallback(async (metodo: string) => {
    const usuario = authStore.getUsuario();
    const usuarioId = usuario?.id ?? 0;

    // Salvar venda no SQLite
    let vendaId = 0;
    try {
      vendaId = await registrarVenda({
        usuarioId,
        total: subtotal,
        metodoPagamento: metodo,
        itens: carrinho.map((it) => ({
          produtoId: it.idCatalogo === 'avulso' ? 0 : Number(it.idCatalogo),
          nome: it.nome,
          qtd: it.qtd,
          precoUnit: it.precoUnit,
        })),
      });
      setUltimaVendaId(vendaId);
      
      // Carregar dados da empresa antecipadamente
      const emp = await getEmpresa();
      setEmpresaDados(emp);
    } catch (e) {
      console.error('Erro ao salvar venda:', e);
    }

    // Atualizar caixa (assíncrono)
    await caixaStore.registrarVenda(subtotal, metodo);

    // Recarregar produtos (estoque atualizado)
    produtosStore.recarregar().catch(() => {});

    receberStore.addTitulo({
      id: `venda-${Date.now()}`,
      descricao: `Venda PDV - ${metodo}`,
      cliente: 'Consumidor Final',
      valor: subtotal,
      vencimento: new Date().toLocaleDateString('pt-BR'),
      status: 'pago',
      categoria: 'Vendas PDV'
    });
    setMetodoPago(metodo);
    if (modalPixQrcodeVisible) setModalPixQrcodeVisible(false);
    setModalPagamentoVisible(false);
    setModalReciboVisible(true);
    setTimerAtivo(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [subtotal, modalPixQrcodeVisible, carrinho]);

  const confirmarVenda = (metodo: string) => {
    if (metodo === 'Pix' && !modalPixQrcodeVisible) {
      setModalPagamentoVisible(false);
      setModalPixQrcodeVisible(true);
      return;
    }
    confirmarVendaReal(metodo);
  };

  useEffect(() => {
    let timeout: any;
    if (modalPixQrcodeVisible && configState.apiToken && configState.apiToken.trim() !== '') {
      setTimerAtivo(true);
      timeout = setTimeout(() => {
        confirmarVendaReal('Pix');
      }, 5000);
    } else {
      setTimerAtivo(false);
    }
    return () => clearTimeout(timeout);
  }, [modalPixQrcodeVisible, configState.apiToken, confirmarVendaReal]);

  // Atalhos de teclado (F2, F3, F4, F5) — apenas na web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Não acionar atalhos quando um modal estiver aberto ou foco em input
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea';
      switch (e.key) {
        case 'F2':
          e.preventDefault();
          if (!modalPagamentoVisible && !modalReciboVisible && !modalCancelVisible && !modalPixQrcodeVisible)
            abrirCancelamentoItem();
          break;
        case 'F3':
          e.preventDefault();
          if (!modalPagamentoVisible && !modalReciboVisible && !modalCancelVisible && !modalPixQrcodeVisible)
            limparCarrinho();
          break;
        case 'F4':
          e.preventDefault();
          if (!modalPagamentoVisible && !modalReciboVisible && !modalCancelVisible && !modalPixQrcodeVisible && !modalCpfVisible) {
            abrirModalCpf();
          }
          break;
        case 'F5':
          e.preventDefault();
          if (!modalPagamentoVisible && !modalReciboVisible && !modalCancelVisible && !modalPixQrcodeVisible)
            finalizar();
          break;
        case 'Escape':
          if (modalPagamentoVisible) setModalPagamentoVisible(false);
          if (modalCancelVisible) setModalCancelVisible(false);
          if (modalPixQrcodeVisible) setModalPixQrcodeVisible(false);
          if (modalCpfVisible) setModalCpfVisible(false);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    abrirCancelamentoItem,
    limparCarrinho,
    finalizar,
    modalPagamentoVisible,
    modalReciboVisible,
    modalCancelVisible,
    modalPixQrcodeVisible,
    modalCpfVisible,
  ]);


  const imprimirRecibo = () => {
    if (Platform.OS === 'web') {
      window.print();
    } else {
      Alert.alert('Impressão', 'Enviando para a impressora configurada...');
    }
  };

  const novaVenda = () => {
    setCarrinho([]);
    setMetodoPago('');
    setValorRecebidoRaw('');
    setCpfCnpjCliente('');
    setUltimaVendaId(null);
    setEmissaoStatus('idle');
    setChaveAcessoEmitida('');
    setProtocoloEmitido('');
    setNumeroNotaEmitido(0);
    setSerieNotaEmitida(0);
    setValorIssEmitido(0);
    setAliquotaIssEmitida(0);
    setModalReciboVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  // Função para emitir nota fiscal integrada à SEFAZ (NFC-e ou NFS-e)
  const emitirNotaFiscal = useCallback(async (tipo: 'NFC-e' | 'NFS-e') => {
    if (!ultimaVendaId) return;
    setTipoEmitido(tipo);
    setEmissaoStatus('gerando');
    
    try {
      const config = await obterConfigFiscal();
      const empresa = await getEmpresa();
      setEmpresaDados(empresa);
      
      if (!empresa?.cnpj) {
        throw new Error('Preencha o CNPJ da sua empresa nas Configurações antes de emitir notas.');
      }
      
      if (tipo === 'NFS-e' && !config.inscricaoMunicipal) {
        throw new Error('Preencha a Inscrição Municipal nas Configurações antes de emitir NFS-e.');
      }
      
      // Simular processamento inicial
      await new Promise(resolve => setTimeout(resolve, 600));
      setEmissaoStatus('transmitindo');

      const result = await transmitirParaSefaz({
        venda: {
          id: ultimaVendaId,
          total: subtotal,
          metodoPagamento: metodoPago,
          status: 'concluida',
          criadoEm: new Date().toISOString(),
          usuarioId: 1
        },
        itens: carrinho.map(it => ({
          produtoId: it.idCatalogo === 'avulso' ? 0 : Number(it.idCatalogo),
          nome: it.nome,
          qtd: it.qtd,
          precoUnit: it.precoUnit
        })),
        config,
        empresa,
        tipo,
        cpfCnpjCliente: cpfCnpjCliente || undefined
      });

      if (result.status === 'erro') {
        throw new Error(result.mensagem || 'Falha de transmissão na API do gateway fiscal.');
      }
      
      // Registrar no Banco de dados local com as informações reais retornadas
      await registrarNotaFiscal({
        vendaId: ultimaVendaId,
        chaveAcesso: result.chaveAcesso,
        numero: result.numero,
        serie: result.serie,
        protocolo: result.protocolo,
        tipo,
        codigoServico: tipo === 'NFS-e' ? config.issCodigoServico : undefined,
        aliquotaIss: tipo === 'NFS-e' ? result.aliquotaIss : undefined,
        valorIss: tipo === 'NFS-e' ? result.valorIss : undefined,
      });
      
      setChaveAcessoEmitida(result.chaveAcesso);
      setProtocoloEmitido(result.protocolo);
      setNumeroNotaEmitido(result.numero);
      setSerieNotaEmitida(result.serie);
      setValorIssEmitido(result.valorIss || 0);
      setAliquotaIssEmitida(result.aliquotaIss || 0);
      setInscricaoMunicipalEmitida(config.inscricaoMunicipal || '');
      setEmissaoStatus('autorizada');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      setEmissaoStatus('erro');
      if (Platform.OS === 'web') window.alert(e.message || 'Erro na transmissão fiscal.');
      else Alert.alert('Erro Fiscal', e.message || 'Erro na transmissão fiscal.');
    }
  }, [ultimaVendaId, subtotal, carrinho, metodoPago, cpfCnpjCliente]);

  // Função para baixar XML da nota emitida
  const baixarXML = useCallback(() => {
    if (!ultimaVendaId || !chaveAcessoEmitida) return;
    
    let xmlContent = '';
    if (tipoEmitido === 'NFC-e') {
      xmlContent = gerarXMLNFCe({
        venda: {
          id: ultimaVendaId,
          usuarioId: 1,
          total: subtotal,
          metodoPagamento: metodoPago,
          status: 'concluida',
          criadoEm: new Date().toISOString(),
        },
        itens: carrinho.map((it) => ({
          produtoId: it.idCatalogo === 'avulso' ? 0 : Number(it.idCatalogo),
          nome: it.nome,
          qtd: it.qtd,
          precoUnit: it.precoUnit,
        })),
        chaveAcesso: chaveAcessoEmitida,
        numero: numeroNotaEmitido,
        serie: serieNotaEmitida,
        protocolo: protocoloEmitido,
        razaoSocial: empresaDados?.razao_social || 'Minha Empresa',
        cnpj: empresaDados?.cnpj || '00.000.000/0001-00',
        endereco: empresaDados?.endereco || 'Av. Principal, 1000',
        cpfCliente: cpfCnpjCliente || undefined,
        ambiente: 'homologacao',
      });
    } else {
      xmlContent = gerarXMLNfse({
        venda: {
          id: ultimaVendaId,
          usuarioId: 1,
          total: subtotal,
          metodoPagamento: metodoPago,
          status: 'concluida',
          criadoEm: new Date().toISOString(),
        },
        itens: carrinho.map((it) => ({
          produtoId: it.idCatalogo === 'avulso' ? 0 : Number(it.idCatalogo),
          nome: it.nome,
          qtd: it.qtd,
          precoUnit: it.precoUnit,
        })),
        chaveAcesso: chaveAcessoEmitida,
        numero: numeroNotaEmitido,
        serie: serieNotaEmitida,
        protocolo: protocoloEmitido,
        razaoSocial: empresaDados?.razao_social || 'Minha Empresa',
        cnpj: empresaDados?.cnpj || '00.000.000/0001-00',
        endereco: empresaDados?.endereco || 'Av. Principal, 1000',
        inscricaoMunicipal: inscricaoMunicipalEmitida || '',
        cpfCliente: cpfCnpjCliente || undefined,
        codigoServico: '14.01',
        aliquotaIss: aliquotaIssEmitida || 5.0,
        valorIss: valorIssEmitido,
        ambiente: 'homologacao',
      });
    }

    if (Platform.OS === 'web') {
      const element = document.createElement("a");
      const file = new Blob([xmlContent], { type: 'text/xml' });
      element.href = URL.createObjectURL(file);
      element.download = `${tipoEmitido}-${chaveAcessoEmitida}.xml`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } else {
      Alert.alert('Download XML', 'Recurso de download disponível apenas no navegador.');
    }
  }, [ultimaVendaId, tipoEmitido, chaveAcessoEmitida, subtotal, metodoPago, carrinho, empresaDados, cpfCnpjCliente, numeroNotaEmitido, serieNotaEmitida, protocoloEmitido, aliquotaIssEmitida, valorIssEmitido]);

  const card = {
    padding: 12,
    backgroundColor: colors.headerBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  };

  const searchRow = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#ffffff', // Fundo branco como solicitado
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    marginBottom: 6,
  };

  const avulsoInputBase = {
    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : 'rgba(248, 250, 252, 0.85)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: borderDiscreto,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 5 : 4,
    color: fieldColor,
    fontSize: 12,
  };

  const barraCurta = {
    width: '68%' as const,
    maxWidth: 300,
    alignSelf: 'flex-start' as const,
  };

  const btnGhost = {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
  };

  const btnPrimarySm = {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignSelf: 'flex-start' as const,
  };

  const qtyInput = {
    backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
    color: fieldColor,
    fontSize: 13,
    minWidth: 36,
    textAlign: 'center' as const,
  };

  const ultimoItem = carrinho.length > 0 ? carrinho[carrinho.length - 1] : null;
  const ultimoItemValor = ultimoItem ? formatMoney(ultimoItem.precoUnit) : 'R$ 0,00';
  const ultimoItemTotal = ultimoItem ? formatMoney(ultimoItem.precoUnit * ultimoItem.qtd) : 'R$ 0,00';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 12, flexDirection: 'row', gap: 12 }}>
      
      {/* Coluna Esquerda */}
      <View style={{ flex: 1, maxWidth: 380, gap: 12 }}>
        {/* Barra superior (Mensagens/Pesquisa) */}
        <View style={{ height: 48, backgroundColor: '#ffffff', borderRadius: 6, justifyContent: 'center', paddingHorizontal: 16, zIndex: 50 }}>
          {caixaStatus === 'fechado' ? (
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#ef4444' }}>
              CAIXA FECHADO - ABRA O CAIXA PARA VENDER
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Search size={18} color={placeholderColor} style={{ marginRight: 8 }} />
              <TextInput
                value={buscaGeral}
                onChangeText={setBuscaGeral}
                onSubmitEditing={resolverCodigoBarras}
                autoFocus
                placeholder="Pesquisar produto por nome ou código..."
                placeholderTextColor={placeholderColor}
                style={{ flex: 1, fontSize: 15, color: '#0f172a', fontWeight: '500', outlineStyle: 'none' } as any}
              />
              
              {buscaGeral.trim() !== '' && (
                <View style={{ position: 'absolute', top: 40, left: 0, right: 0, backgroundColor: '#ffffff', borderRadius: 8, maxHeight: 300, zIndex: 100, borderWidth: 1, borderColor: '#cbd5e1', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 }}>
                  {filtrados.length === 0 ? (
                    <Text style={{ padding: 16, color: '#64748b', textAlign: 'center' }}>Nenhum produto encontrado.</Text>
                  ) : (
                    <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                      {filtrados.map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          onPress={() => {
                            addDoCatalogo(p);
                            setBuscaGeral('');
                          }}
                          style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <View>
                            <Text style={{ fontWeight: 'bold', color: '#0f172a', fontSize: 14 }}>{p.nome}</Text>
                            {!!p.codigo && <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Cód: {p.codigo}</Text>}
                          </View>
                          <Text style={{ fontWeight: '800', color: colors.accent }}>{formatMoney(p.precoVenda)}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        <View style={{ height: 180, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 34, fontWeight: '900', color: '#ffffff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 4, textAlign: 'center' }}>
            CONECTA SISTEMAS
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#f59e0b', marginTop: 4, textAlign: 'center' }}>
            SOLUÇÕES PARA SUA EMPRESA!
          </Text>
          <Text style={{ fontSize: 12, color: '#e2e8f0', marginTop: 12, textAlign: 'center' }}>
            Bem Vindo ao Sistema
          </Text>
        </View>

        {/* VALOR UNITÁRIO */}
        <View style={{ backgroundColor: colors.headerBackground, borderRadius: 6, overflow: 'hidden' }}>
           <View style={{ backgroundColor: '#0f172a', paddingVertical: 6, paddingHorizontal: 10 }}>
             <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 12 }}>VALOR UNITÁRIO</Text>
           </View>
           <View style={{ padding: 8 }}>
             <View style={{ backgroundColor: '#ffffff', borderRadius: 4, paddingVertical: 8, paddingHorizontal: 12 }}>
               <Text style={{ fontSize: 28, fontWeight: '800', textAlign: 'right', color: '#0f172a' }}>{ultimoItemValor}</Text>
             </View>
           </View>
        </View>

        {/* TOTAL DO ITEM */}
        <View style={{ backgroundColor: colors.headerBackground, borderRadius: 6, overflow: 'hidden' }}>
           <View style={{ backgroundColor: '#0f172a', paddingVertical: 6, paddingHorizontal: 10 }}>
             <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 12 }}>TOTAL DO ITEM</Text>
           </View>
           <View style={{ padding: 8 }}>
             <View style={{ backgroundColor: '#ffffff', borderRadius: 4, paddingVertical: 8, paddingHorizontal: 12 }}>
               <Text style={{ fontSize: 28, fontWeight: '800', textAlign: 'right', color: '#0f172a' }}>{ultimoItemTotal}</Text>
             </View>
           </View>
        </View>

        {/* CÓDIGO & VAZIO */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
           <View style={{ flex: 1.5, backgroundColor: colors.headerBackground, borderRadius: 6, overflow: 'hidden' }}>
             <View style={{ backgroundColor: '#0f172a', paddingVertical: 6, paddingHorizontal: 10 }}>
               <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 12 }}>CÓDIGO</Text>
             </View>
             <View style={{ padding: 8 }}>
               <View style={{ backgroundColor: '#ffffff', borderRadius: 4, paddingVertical: 8, paddingHorizontal: 12 }}>
                 <Text style={{ fontSize: 20, fontWeight: 'bold', textAlign: 'center', color: '#0f172a' }} numberOfLines={1}>
                   {ultimoItem ? ultimoItem.idCatalogo : '-'}
                 </Text>
               </View>
             </View>
           </View>
           <View style={{ flex: 1, backgroundColor: colors.headerBackground, borderRadius: 6, overflow: 'hidden' }}>
             <View style={{ backgroundColor: '#0f172a', paddingVertical: 6, paddingHorizontal: 10 }}>
               <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 12 }}>QTD</Text>
             </View>
             <View style={{ padding: 8 }}>
               <View style={{ backgroundColor: '#ffffff', borderRadius: 4, paddingVertical: 8, paddingHorizontal: 12 }}>
                 <Text style={{ fontSize: 20, fontWeight: 'bold', textAlign: 'center', color: '#0f172a' }}>{ultimoItem ? ultimoItem.qtd : '-'}</Text>
               </View>
             </View>
           </View>
        </View>

        {/* Shortcuts */}
        <View style={{ backgroundColor: '#ffffff', borderRadius: 6, padding: 8, marginTop: 'auto' }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Text style={{ width: '50%', fontSize: 10, fontWeight: 'bold', color: '#334155', marginBottom: 4 }}>F2 - Cancelar Item</Text>
            <Text style={{ width: '50%', fontSize: 10, fontWeight: 'bold', color: '#334155', marginBottom: 4 }}>F3 - Cancelar Venda</Text>
            <Text style={{ width: '50%', fontSize: 10, fontWeight: 'bold', color: '#334155', marginBottom: 4 }}>F4 - CPF / CNPJ</Text>
            <Text style={{ width: '50%', fontSize: 10, fontWeight: 'bold', color: '#334155', marginBottom: 4 }}>F5 - Finalizar</Text>
          </View>
        </View>
      </View>

      {/* Coluna Direita */}
      <View style={{ flex: 2, gap: 12 }}>
         {/* Lista de Produtos */}
         <View style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
           <View style={{ backgroundColor: '#0f172a', paddingVertical: 8 }}>
             <Text style={{ color: '#ffffff', fontWeight: 'bold', textAlign: 'center', fontSize: 14 }}>LISTA DE PRODUTOS</Text>
           </View>
           <View style={{ flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: '#f8fafc' }}>
             <Text style={{ width: 40, fontSize: 11, fontWeight: 'bold', color: '#0f172a' }}>Item</Text>
             <Text style={{ width: 120, fontSize: 11, fontWeight: 'bold', color: '#0f172a' }}>Código de Barras</Text>
             <Text style={{ flex: 1, fontSize: 11, fontWeight: 'bold', color: '#0f172a' }}>Descrição</Text>
             <Text style={{ width: 50, fontSize: 11, fontWeight: 'bold', color: '#0f172a', textAlign: 'center' }}>Qtd</Text>
             <Text style={{ width: 80, fontSize: 11, fontWeight: 'bold', color: '#0f172a', textAlign: 'right' }}>Vlr. Unit</Text>
             <Text style={{ width: 90, fontSize: 11, fontWeight: 'bold', color: '#0f172a', textAlign: 'right' }}>Total</Text>
             <Text style={{ width: 40, fontSize: 11, fontWeight: 'bold', color: '#0f172a', textAlign: 'center' }}>Ação</Text>
           </View>
           <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 8 }}>
             {carrinho.length === 0 ? (
               <Text style={{ textAlign: 'center', marginTop: 40, color: '#94a3b8', fontSize: 16 }}>Nenhum item adicionado.</Text>
             ) : (
               carrinho.map((it, i) => (
                 <View key={it.key} style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#f1f5f9', alignItems: 'center' }}>
                   <Text style={{ width: 40, fontSize: 11, color: '#334155' }}>{(i + 1).toString().padStart(3, '0')}</Text>
                   <Text style={{ width: 120, fontSize: 11, color: '#334155' }}>{it.idCatalogo}</Text>
                   <Text style={{ flex: 1, fontSize: 11, color: '#334155', fontWeight: '600' }} numberOfLines={1}>{it.nome}</Text>
                   <Text style={{ width: 50, fontSize: 11, color: '#334155', textAlign: 'center' }}>{it.qtd}</Text>
                   <Text style={{ width: 80, fontSize: 11, color: '#334155', textAlign: 'right' }}>{formatMoney(it.precoUnit)}</Text>
                   <Text style={{ width: 90, fontSize: 11, color: '#334155', textAlign: 'right', fontWeight: 'bold' }}>{formatMoney(it.precoUnit * it.qtd)}</Text>
                   <TouchableOpacity onPress={() => removerLinha(it.key)} style={{ width: 40, alignItems: 'center' }}>
                     <Trash2 size={16} color="#ef4444" />
                   </TouchableOpacity>
                 </View>
               ))
             )}
           </ScrollView>
         </View>

         {/* SUBTOTAL */}
         <View style={{ backgroundColor: colors.headerBackground, borderRadius: 6, overflow: 'hidden' }}>
           <View style={{ backgroundColor: '#0f172a', paddingVertical: 8, paddingHorizontal: 16 }}>
             <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 14 }}>SUBTOTAL</Text>
           </View>
           <View style={{ padding: 12 }}>
             <View style={{ backgroundColor: '#ffffff', borderRadius: 4, paddingVertical: 12, paddingHorizontal: 16 }}>
               <Text style={{ fontSize: 48, fontWeight: '900', textAlign: 'right', color: '#0f172a' }}>{formatMoney(subtotal)}</Text>
             </View>
           </View>
         </View>

         {/* RECEBIDO E TROCO E BOTAO FINALIZAR */}
         <View style={{ flexDirection: 'row', gap: 12 }}>
           <View style={{ flex: 1, backgroundColor: colors.headerBackground, borderRadius: 6, overflow: 'hidden' }}>
             <View style={{ backgroundColor: '#0f172a', paddingVertical: 6, paddingHorizontal: 10 }}>
               <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 12 }}>TOTAL RECEBIDO</Text>
             </View>
             <View style={{ padding: 8 }}>
               <View style={{ backgroundColor: '#ffffff', borderRadius: 4, paddingVertical: 8, paddingHorizontal: 12 }}>
                 <TextInput
                   value={valorRecebidoRaw}
                   onChangeText={setValorRecebidoRaw}
                   keyboardType="numeric"
                   placeholder="0,00"
                   placeholderTextColor="#94a3b8"
                   style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'right', color: '#0f172a', outlineStyle: 'none' } as any}
                 />
               </View>
             </View>
           </View>
           <View style={{ flex: 1, backgroundColor: colors.headerBackground, borderRadius: 6, overflow: 'hidden' }}>
             <View style={{ backgroundColor: '#0f172a', paddingVertical: 6, paddingHorizontal: 10 }}>
               <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 12 }}>TROCO</Text>
             </View>
             <View style={{ padding: 8 }}>
               <View style={{ backgroundColor: '#ffffff', borderRadius: 4, paddingVertical: 8, paddingHorizontal: 12 }}>
                 <Text style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'right', color: '#0f172a' }}>{formatMoney(troco)}</Text>
               </View>
             </View>
           </View>
           <View style={{ flex: 1.5, flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignContent: 'space-between' }}>
             <TouchableOpacity onPress={abrirCancelamentoItem} style={{ flex: 1, minWidth: '45%', backgroundColor: '#475569', borderRadius: 6, justifyContent: 'center', alignItems: 'center', paddingVertical: 8 }}>
               <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 11 }}>CANC. ITEM</Text>
               <Text style={{ color: '#ffffff', opacity: 0.8, fontSize: 10 }}>(F2)</Text>
             </TouchableOpacity>
             <TouchableOpacity onPress={limparCarrinho} style={{ flex: 1, minWidth: '45%', backgroundColor: '#ef4444', borderRadius: 6, justifyContent: 'center', alignItems: 'center', paddingVertical: 8 }}>
               <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 11 }}>CANC. VENDA</Text>
               <Text style={{ color: '#ffffff', opacity: 0.8, fontSize: 10 }}>(F3)</Text>
             </TouchableOpacity>
             <TouchableOpacity onPress={abrirModalCpf} style={{ flex: 1, minWidth: '45%', backgroundColor: '#3b82f6', borderRadius: 6, justifyContent: 'center', alignItems: 'center', paddingVertical: 8 }}>
               <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 11 }}>CPF / CNPJ</Text>
               <Text style={{ color: '#ffffff', opacity: 0.8, fontSize: 10 }}>(F4)</Text>
             </TouchableOpacity>
             <TouchableOpacity
               onPress={finalizar}
               disabled={caixaStatus === 'fechado'}
               style={{ flex: 1, minWidth: '45%', backgroundColor: caixaStatus === 'fechado' ? '#94a3b8' : colors.accent, borderRadius: 6, justifyContent: 'center', alignItems: 'center', paddingVertical: 8 }}
             >
               <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 11 }}>FINALIZAR</Text>
               <Text style={{ color: '#ffffff', opacity: 0.8, fontSize: 10 }}>(F5)</Text>
             </TouchableOpacity>
           </View>
         </View>
      </View>

      {/* Modal Pagamento */}
      <Modal visible={modalPagamentoVisible} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setModalPagamentoVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setModalPagamentoVisible(false)} />
          <Animated.View entering={FadeIn} style={styles.cardWrap}>
            <View style={[styles.modalCard, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textHeader }}>Pagamento</Text>
                <TouchableOpacity onPress={() => setModalPagamentoVisible(false)} hitSlop={12} style={{ padding: 4 }}>
                  <X size={22} color={colors.textHeader} />
                </TouchableOpacity>
              </View>

              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>Total a pagar</Text>
                <Text style={{ fontSize: 28, fontWeight: '900', color: colors.accent }}>{formatMoney(subtotal)}</Text>
              </View>

              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textHeader, marginBottom: 12 }}>Selecione o método:</Text>
              
              <View style={{ gap: 10 }}>
                <TouchableOpacity 
                  onPress={() => confirmarVenda('Dinheiro')}
                  style={[styles.paymentBtn, { backgroundColor: '#10b98115', borderColor: '#10b981' }]}
                >
                  <Banknote size={24} color="#10b981" />
                  <Text style={[styles.paymentBtnText, { color: '#10b981' }]}>Dinheiro</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => confirmarVenda('Cartão')}
                  style={[styles.paymentBtn, { backgroundColor: '#3b82f615', borderColor: '#3b82f6' }]}
                >
                  <CreditCard size={24} color="#3b82f6" />
                  <Text style={[styles.paymentBtnText, { color: '#3b82f6' }]}>Cartão (Débito/Crédito)</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => confirmarVenda('Pix')}
                  style={[styles.paymentBtn, { backgroundColor: '#8b5cf615', borderColor: '#8b5cf6' }]}
                >
                  <QrCode size={24} color="#8b5cf6" />
                  <Text style={[styles.paymentBtnText, { color: '#8b5cf6' }]}>Pix</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Modal Recibo */}
      <Modal visible={modalReciboVisible} animationType="fade" transparent statusBarTranslucent onRequestClose={novaVenda}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={novaVenda} />
          <Animated.View entering={FadeIn} style={styles.cardWrap}>
            <View style={[styles.modalCard, { backgroundColor: '#fff', borderColor: '#ccc', borderRadius: 0 }]}>
              
              {/* Cupom Header */}
              <View style={{ alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#ccc', borderStyle: 'dashed', paddingBottom: 16, marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#000', marginBottom: 4 }}>CONECTA SISTEMAS PDV</Text>
                <Text style={{ fontSize: 12, color: '#333', textAlign: 'center' }}>Av. Principal, 1000 - Centro</Text>
                <Text style={{ fontSize: 12, color: '#333', textAlign: 'center' }}>CNPJ: 00.000.000/0001-00</Text>
                <Text style={{ fontSize: 12, color: '#333', marginTop: 8 }}>{new Date().toLocaleString('pt-BR')}</Text>
              </View>

              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#000', marginBottom: 4, textAlign: 'center' }}>
                CUPOM NÃO FISCAL
              </Text>
              
              {!!cpfCnpjCliente && (
                <View style={{ marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#ccc', borderStyle: 'dashed', paddingBottom: 8 }}>
                  <Text style={{ fontSize: 11, color: '#333', textAlign: 'center' }}>CONSUMIDOR</Text>
                  <Text style={{ fontSize: 12, color: '#000', fontWeight: 'bold', textAlign: 'center' }}>CPF/CNPJ: {cpfCnpjCliente}</Text>
                </View>
              )}

              {/* Itens */}
              <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                {carrinho.map((it, i) => (
                  <View key={it.key} style={{ marginBottom: 8 }}>
                    <Text style={{ fontSize: 12, color: '#000' }}>
                      {String(i + 1).padStart(3, '0')} {it.nome.substring(0, 20)}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12, color: '#000' }}>
                        {it.qtd} x {it.precoUnit.toFixed(2)}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#000' }}>
                        {(it.qtd * it.precoUnit).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>

              {/* Totais */}
              <View style={{ borderTopWidth: 1, borderTopColor: '#ccc', borderStyle: 'dashed', paddingTop: 16, marginTop: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#000' }}>TOTAL R$</Text>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#000' }}>{subtotal.toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: '#000' }}>PAGAMENTO</Text>
                  <Text style={{ fontSize: 12, color: '#000' }}>{metodoPago}</Text>
                </View>
              </View>

              <Text style={{ fontSize: 11, color: '#666', textAlign: 'center', marginTop: 20, marginBottom: 20 }}>
                Obrigado pela preferência e volte sempre!
              </Text>

              {/* Botões de Ação */}
              <View style={{ gap: 12 }}>
                {emissaoStatus === 'idle' && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity 
                      onPress={() => emitirNotaFiscal('NFC-e')}
                      style={{ flex: 1, backgroundColor: '#8b5cf6', padding: 14, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                    >
                      <QrCode size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>Emitir NFC-e (Prod)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => emitirNotaFiscal('NFS-e')}
                      style={{ flex: 1, backgroundColor: '#3b82f6', padding: 14, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                    >
                      <QrCode size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>Emitir NFS-e (Serv)</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {(emissaoStatus === 'gerando' || emissaoStatus === 'transmitindo') && (
                  <View 
                    style={{ backgroundColor: '#8b5cf690', padding: 14, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                  >
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                      {emissaoStatus === 'gerando' ? 'Gerando XML...' : 'Enviando para SEFAZ...'}
                    </Text>
                  </View>
                )}

                {emissaoStatus === 'autorizada' && (
                  <TouchableOpacity 
                    onPress={() => setDanfeModalVisible(true)}
                    style={{ backgroundColor: '#10b981', padding: 14, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                  >
                    <QrCode size={20} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                      Visualizar {tipoEmitido === 'NFC-e' ? 'DANFE NFC-e' : 'DANFSE NFS-e'}
                    </Text>
                  </TouchableOpacity>
                )}

                {emissaoStatus === 'erro' && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity 
                      onPress={() => emitirNotaFiscal('NFC-e')}
                      style={{ flex: 1, backgroundColor: '#ef4444', padding: 14, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                    >
                      <RotateCcw size={16} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>Reemitir NFC-e</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => emitirNotaFiscal('NFS-e')}
                      style={{ flex: 1, backgroundColor: '#ef4444', padding: 14, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                    >
                      <RotateCcw size={16} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>Reemitir NFS-e</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity 
                  onPress={imprimirRecibo}
                  style={{ backgroundColor: '#000', padding: 14, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                >
                  <Printer size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Imprimir Cupom</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={novaVenda}
                  style={{ backgroundColor: '#e2e8f0', padding: 14, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                >
                  <RotateCcw size={20} color="#000" />
                  <Text style={{ color: '#000', fontWeight: 'bold' }}>Nova Venda</Text>
                </TouchableOpacity>
              </View>

            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Modal Cancelar Item */}
      <Modal visible={modalCancelVisible} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setModalCancelVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setModalCancelVisible(false)} />
          <Animated.View entering={FadeIn} style={styles.cardWrap}>
            <View style={[styles.modalCard, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textHeader }}>Cancelar Item</Text>
                <TouchableOpacity onPress={() => setModalCancelVisible(false)} hitSlop={12} style={{ padding: 4 }}>
                  <X size={22} color={colors.textHeader} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>
                Digite o código ou nome do produto que deseja remover, e confirme com a senha do administrador.
              </Text>

              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.textHeader, marginBottom: 6 }}>Produto a Cancelar</Text>
                <TextInput
                  value={cancelBusca}
                  onChangeText={setCancelBusca}
                  placeholder="Código de barras ou Nome"
                  placeholderTextColor={placeholderColor}
                  style={[avulsoInputBase, { fontSize: 14 }]}
                />
              </View>

              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.textHeader, marginBottom: 6 }}>Senha do Administrador</Text>
                <TextInput
                  value={cancelSenha}
                  onChangeText={setCancelSenha}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={placeholderColor}
                  style={[avulsoInputBase, { fontSize: 14 }]}
                />
              </View>

              <TouchableOpacity 
                onPress={confirmarCancelamentoItem}
                style={{ backgroundColor: '#ef4444', padding: 14, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}
              >
                <Trash2 size={20} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Confirmar Cancelamento</Text>
              </TouchableOpacity>

            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Modal QR Code Pix */}
      <Modal visible={modalPixQrcodeVisible} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setModalPixQrcodeVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setModalPixQrcodeVisible(false)} />
          <Animated.View entering={FadeIn} style={styles.cardWrap}>
            <View style={[styles.modalCard, { backgroundColor: colors.headerBackground, borderColor: colors.border, alignItems: 'center' }]}>
              <View style={[styles.cardHeader, { width: '100%' }]}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textHeader }}>Pagamento via Pix</Text>
                <TouchableOpacity onPress={() => setModalPixQrcodeVisible(false)} hitSlop={12} style={{ padding: 4 }}>
                  <X size={22} color={colors.textHeader} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 20, textAlign: 'center' }}>
                Escaneie o QR Code abaixo no aplicativo do seu banco para pagar:
              </Text>

              {/* Mock QR Code Image/Square */}
              <View style={{ width: 200, height: 200, backgroundColor: '#fff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                {pixPayloadStr ? (
                  <QRCode
                    value={pixPayloadStr}
                    size={160}
                    color="black"
                    backgroundColor="white"
                  />
                ) : (
                  <QrCode size={160} color="#000" />
                )}
              </View>
              
              <Text style={{ fontSize: 24, fontWeight: '900', color: '#8b5cf6', marginBottom: 24 }}>
                {formatMoney(subtotal)}
              </Text>

              {timerAtivo ? (
                <View style={{ paddingVertical: 14, paddingHorizontal: 24, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, width: '100%', backgroundColor: '#f59e0b' }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Aguardando banco (Simulação API)...</Text>
                </View>
              ) : (
                <TouchableOpacity 
                  onPress={() => confirmarVenda('Pix')}
                  style={{ backgroundColor: '#10b981', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, width: '100%' }}
                >
                  <Banknote size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Confirmar Pagamento Manual</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Modal CPF / CNPJ */}
      <Modal visible={modalCpfVisible} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setModalCpfVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setModalCpfVisible(false)} />
          <Animated.View entering={FadeIn} style={styles.cardWrap}>
            <View style={[styles.modalCard, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textHeader }}>Documento do Cliente</Text>
                <TouchableOpacity onPress={() => setModalCpfVisible(false)} hitSlop={12} style={{ padding: 4 }}>
                  <X size={22} color={colors.textHeader} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>
                Digite o CPF ou CNPJ do consumidor para que seja impresso no cupom da venda atual.
              </Text>

              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.textHeader, marginBottom: 6 }}>CPF / CNPJ</Text>
                <TextInput
                  value={cpfCnpjCliente}
                  onChangeText={setCpfCnpjCliente}
                  placeholder="000.000.000-00"
                  placeholderTextColor={placeholderColor}
                  keyboardType="numeric"
                  autoFocus
                  onSubmitEditing={confirmarCpfCnpj}
                  style={[avulsoInputBase, { fontSize: 16, paddingVertical: 10 }]}
                />
              </View>

              <TouchableOpacity 
                onPress={confirmarCpfCnpj}
                style={{ backgroundColor: colors.accent, padding: 14, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Confirmar</Text>
              </TouchableOpacity>

            </View>
          </Animated.View>
        </View>
      </Modal>

        {/* Modal DANFE NFC-e / NFS-e */}
        <Modal visible={danfeModalVisible} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setDanfeModalVisible(false)}>
          <View style={styles.modalRoot}>
            <Pressable style={styles.backdrop} onPress={() => setDanfeModalVisible(false)} />
            <Animated.View entering={FadeIn} style={[styles.cardWrap, { maxWidth: 500 }]}>
              <View style={[styles.modalCard, { backgroundColor: '#fff', borderColor: '#ccc', borderRadius: 0, paddingHorizontal: 12, paddingVertical: 16 }]}>
                
                {/* Header com botões de controle */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 10, marginBottom: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0f172a' }}>
                    {tipoEmitido === 'NFC-e' ? 'DANFE NFC-e Emitida' : 'DANFSE NFS-e Emitida'}
                  </Text>
                  <TouchableOpacity onPress={() => setDanfeModalVisible(false)} style={{ padding: 4 }}>
                    <X size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>

                {/* Área do Cupom (Imprimível) */}
                <ScrollView style={{ maxHeight: 350, backgroundColor: '#fdfdfd', borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }} showsVerticalScrollIndicator={false}>
                  {tipoEmitido === 'NFC-e' ? (
                    // LAYOUT NFC-e (Produtos)
                    <View>
                      {/* Cabeçalho do Emitente */}
                      <View style={{ alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#000', borderStyle: 'dashed', paddingBottom: 10, marginBottom: 10 }}>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#000', textAlign: 'center' }}>
                          {empresaDados?.razao_social || 'CONECTA SISTEMAS'}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#000', textAlign: 'center' }}>
                          CNPJ: {empresaDados?.cnpj || '00.000.000/0001-00'}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#000', textAlign: 'center' }}>
                          IE: 111.222.333.444
                        </Text>
                        <Text style={{ fontSize: 10, color: '#000', textAlign: 'center', marginTop: 2 }}>
                          {empresaDados?.endereco || 'Av. Principal, 1000 - Centro'}
                        </Text>
                      </View>

                      {/* Título do Documento */}
                      <View style={{ alignItems: 'center', marginBottom: 10 }}>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#000', textAlign: 'center' }}>
                          DANFE NFC-e
                        </Text>
                        <Text style={{ fontSize: 9, color: '#000', textAlign: 'center' }}>
                          Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
                        </Text>
                        <Text style={{ fontSize: 9, color: '#000', textAlign: 'center' }}>
                          Não permite aproveitamento de crédito de ICMS
                        </Text>
                      </View>

                      {/* Detalhe de Itens */}
                      <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', borderStyle: 'dashed', paddingBottom: 6, marginBottom: 6 }}>
                        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', borderStyle: 'dotted', paddingBottom: 2, marginBottom: 4 }}>
                          <Text style={{ flex: 1, fontSize: 9, fontWeight: 'bold', color: '#000' }}>CÓD | DESCRIÇÃO</Text>
                          <Text style={{ width: 40, fontSize: 9, fontWeight: 'bold', color: '#000', textAlign: 'right' }}>QTD</Text>
                          <Text style={{ width: 45, fontSize: 9, fontWeight: 'bold', color: '#000', textAlign: 'right' }}>VL UN</Text>
                          <Text style={{ width: 45, fontSize: 9, fontWeight: 'bold', color: '#000', textAlign: 'right' }}>TOTAL</Text>
                        </View>
                        {carrinho.map((it, idx) => (
                          <View key={it.key} style={{ marginBottom: 4 }}>
                            <Text style={{ fontSize: 10, color: '#000' }}>
                              {String(idx + 1).padStart(3, '0')} | {it.idCatalogo || 'AVULSO'} {it.nome}
                            </Text>
                            <View style={{ flexDirection: 'row' }}>
                              <Text style={{ flex: 1, fontSize: 9, color: '#000' }}>Un: UN</Text>
                              <Text style={{ width: 40, fontSize: 9, color: '#000', textAlign: 'right' }}>{it.qtd}</Text>
                              <Text style={{ width: 45, fontSize: 9, color: '#000', textAlign: 'right' }}>{it.precoUnit.toFixed(2)}</Text>
                              <Text style={{ width: 45, fontSize: 9, color: '#000', textAlign: 'right' }}>{(it.qtd * it.precoUnit).toFixed(2)}</Text>
                            </View>
                          </View>
                        ))}
                      </View>

                      {/* Totais */}
                      <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', borderStyle: 'dashed', paddingBottom: 6, marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#000' }}>QTD. TOTAL DE ITENS</Text>
                          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#000' }}>{carrinho.length}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#000' }}>VALOR TOTAL R$</Text>
                          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#000' }}>{subtotal.toFixed(2)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={{ fontSize: 10, color: '#000' }}>VALOR A PAGAR R$</Text>
                          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#000' }}>{subtotal.toFixed(2)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 9, color: '#000' }}>FORMA PAGAMENTO ({metodoPago})</Text>
                          <Text style={{ fontSize: 9, color: '#000' }}>{subtotal.toFixed(2)}</Text>
                        </View>
                      </View>

                      {/* Mensagem Tributos */}
                      <Text style={{ fontSize: 9, color: '#000', textAlign: 'center', fontStyle: 'italic', marginBottom: 10 }}>
                        Informação dos Tributos Totais Incidentes (Lei Federal 12.741/2012): R$ {(subtotal * 0.1345).toFixed(2)} (13.45%)
                      </Text>

                      {/* Dados da Consulta */}
                      <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', borderStyle: 'dashed', paddingBottom: 8, marginBottom: 10, alignItems: 'center' }}>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000', marginBottom: 2 }}>
                          ÁREA DE MENSAGEM DA SEFAZ
                        </Text>
                        <Text style={{ fontSize: 8, color: '#000', textAlign: 'center', marginBottom: 4 }}>
                          NFC-e autorizada em contingência / homologação. Consulte pela Chave de Acesso em:
                        </Text>
                        <Text style={{ fontSize: 8, color: '#000', fontWeight: 'bold', textAlign: 'center', marginBottom: 6 }}>
                          https://www.nfe.fazenda.gov.br/portal/consulta
                        </Text>
                        
                        {/* Chave de Acesso formatada */}
                        <Text style={{ fontSize: 8, color: '#000', textAlign: 'center', fontWeight: 'bold', letterSpacing: 0.5 }}>
                          CHAVE DE ACESSO:
                        </Text>
                        <Text style={{ fontSize: 9, color: '#000', textAlign: 'center', fontWeight: 'bold', letterSpacing: 0.5, maxWidth: '90%' }}>
                          {chaveAcessoEmitida.replace(/(.{4})/g, '$1 ')}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    // LAYOUT NFS-e (Serviços)
                    <View>
                      {/* Cabeçalho Prefeitura */}
                      <View style={{ alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 10, marginBottom: 10 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#e2e8f0', borderWidth: 1, borderColor: '#000', justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
                          <Text style={{ fontSize: 8, fontWeight: 'bold' }}>MUN</Text>
                        </View>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#000', textAlign: 'center' }}>
                          PREFEITURA MUNICIPAL DE SÃO PAULO
                        </Text>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#000', textAlign: 'center' }}>
                          NOTA FISCAL ELETRÔNICA DE SERVIÇOS - NFS-e
                        </Text>
                      </View>

                      {/* Dados da Nota */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#000', borderStyle: 'dashed', paddingBottom: 8, marginBottom: 10 }}>
                        <View>
                          <Text style={{ fontSize: 8, color: '#555' }}>NÚMERO DA NOTA</Text>
                          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#000' }}>{numeroNotaEmitido + 5000}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 8, color: '#555' }}>CÓD. VERIFICAÇÃO</Text>
                          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#000' }}>{chaveAcessoEmitida.substring(0, 8).toUpperCase()}</Text>
                        </View>
                      </View>

                      {/* Prestador */}
                      <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', borderStyle: 'dashed', paddingBottom: 8, marginBottom: 10 }}>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000', marginBottom: 2 }}>PRESTADOR DE SERVIÇOS</Text>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#000' }}>{empresaDados?.razao_social || 'CONECTA SISTEMAS'}</Text>
                        <Text style={{ fontSize: 10, color: '#000' }}>CNPJ: {empresaDados?.cnpj || '00.000.000/0001-00'}</Text>
                        <Text style={{ fontSize: 10, color: '#000' }}>Inscrição Municipal: {inscricaoMunicipalEmitida || '123456-7'}</Text>
                        <Text style={{ fontSize: 9, color: '#000', marginTop: 2 }}>{empresaDados?.endereco || 'Av. Principal, 1000 - Centro'}</Text>
                      </View>

                      {/* Tomador */}
                      <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', borderStyle: 'dashed', paddingBottom: 8, marginBottom: 10 }}>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000', marginBottom: 2 }}>TOMADOR DE SERVIÇOS</Text>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#000' }}>
                          {cpfCnpjCliente ? 'CONSUMIDOR IDENTIFICADO' : 'CONSUMIDOR NÃO IDENTIFICADO'}
                        </Text>
                        {!!cpfCnpjCliente && <Text style={{ fontSize: 10, color: '#000' }}>CPF/CNPJ: {cpfCnpjCliente}</Text>}
                      </View>

                      {/* Discriminação de Serviços */}
                      <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', borderStyle: 'dashed', paddingBottom: 8, marginBottom: 10 }}>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000', marginBottom: 4 }}>DISCRIMINAÇÃO DOS SERVIÇOS</Text>
                        <View style={{ backgroundColor: '#f1f5f9', padding: 8, borderRadius: 4 }}>
                          {carrinho.map((it, idx) => (
                            <Text key={idx} style={{ fontSize: 10, color: '#334155', marginBottom: 2 }}>
                              • {it.qtd}x {it.nome} - R$ {(it.qtd * it.precoUnit).toFixed(2)}
                            </Text>
                          ))}
                        </View>
                      </View>

                      {/* Valores e Retenções */}
                      <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', borderStyle: 'dashed', paddingBottom: 8, marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={{ fontSize: 10, color: '#000' }}>VALOR TOTAL DOS SERVIÇOS:</Text>
                          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#000' }}>R$ {subtotal.toFixed(2)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={{ fontSize: 10, color: '#000' }}>BASE DE CÁLCULO:</Text>
                          <Text style={{ fontSize: 10, color: '#000' }}>R$ {subtotal.toFixed(2)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={{ fontSize: 10, color: '#000' }}>ALÍQUOTA ISS:</Text>
                          <Text style={{ fontSize: 10, color: '#000' }}>{aliquotaIssEmitida.toFixed(2)}%</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#000' }}>VALOR DO ISS:</Text>
                          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#000' }}>R$ {valorIssEmitido.toFixed(2)}</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Consumidor */}
                  {tipoEmitido === 'NFC-e' && (
                    <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', borderStyle: 'dashed', paddingBottom: 6, marginBottom: 10, alignItems: 'center' }}>
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#000' }}>
                        CONSUMIDOR
                      </Text>
                      <Text style={{ fontSize: 9, color: '#000' }}>
                        {cpfCnpjCliente ? `CNPJ/CPF: ${cpfCnpjCliente}` : 'CONSUMIDOR NÃO IDENTIFICADO'}
                      </Text>
                    </View>
                  )}

                  {/* Número, Série e Protocolo */}
                  {tipoEmitido === 'NFC-e' && (
                    <View style={{ alignItems: 'center', marginBottom: 16 }}>
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#000' }}>
                        NFC-e Nº {numeroNotaEmitido} | Série {serieNotaEmitida}
                      </Text>
                      <Text style={{ fontSize: 9, color: '#000' }}>
                        Protocolo de Autorização: {protocoloEmitido}
                      </Text>
                      <Text style={{ fontSize: 9, color: '#000' }}>
                        Data de Autorização: {new Date().toLocaleString('pt-BR')}
                      </Text>
                    </View>
                  )}

                  {/* QR Code */}
                  <View style={{ alignItems: 'center', marginBottom: 20 }}>
                    {chaveAcessoEmitida ? (
                      <QRCode
                        value={tipoEmitido === 'NFC-e'
                          ? `https://www.nfe.fazenda.gov.br/portal/consultaRecipiente?chave=${chaveAcessoEmitida}`
                          : `https://nfe.prefeitura.sp.gov.br/consulta?inscricao=${inscricaoMunicipalEmitida}&nf=${numeroNotaEmitido + 5000}&cod=${chaveAcessoEmitida.substring(0, 8)}`
                        }
                        size={110}
                        color="black"
                        backgroundColor="white"
                      />
                    ) : null}
                    <Text style={{ fontSize: 8, color: '#000', marginTop: 4 }}>
                      Consulta via leitor de QR Code
                    </Text>
                  </View>
                </ScrollView>

                {/* Botões do Modal */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TouchableOpacity
                    onPress={baixarXML}
                    style={{ flex: 1, backgroundColor: '#475569', padding: 12, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'center', width: '100%' }}>Baixar XML</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (Platform.OS === 'web') window.print();
                      else Alert.alert('Imprimir', 'Enviando para impressora térmica...');
                    }}
                    style={{ flex: 1, backgroundColor: '#0f172a', padding: 12, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                  >
                    <Printer size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>Imprimir</Text>
                  </TouchableOpacity>
                </View>

              </View>
            </Animated.View>
          </View>
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
    maxWidth: 400,
    paddingHorizontal: 20,
    zIndex: 2,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
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
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.35)',
  },
  paymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  paymentBtnText: {
    fontSize: 16,
    fontWeight: '700',
  }
});
