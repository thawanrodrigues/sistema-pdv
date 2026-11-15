import React, { useCallback, useState } from 'react';
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
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../ui/themes/index.theme';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { PackagePlus, Trash2, X, Pencil, Search, Printer } from 'lucide-react-native';
import { produtosStore, ProdutoCadastro } from '../store/produtosStore';
import { configStore } from '../store/configStore';

const emptyForm = {
  nome: '',
  codigo: '',
  precoVenda: '',
  precoCusto: '',
  unidade: 'UN',
  estoque: '',
  categoria: '',
  observacoes: '',
};

function parseMoney(raw: string): number {
  const t = raw.trim();
  if (!t) return 0;
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = parseFloat(normalized) || 0;
  return Math.round(n * 100) / 100;
}

function formatMoney(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ProdutosScreen() {
  const { colors, isDark } = useTheme();
  const [form, setForm] = useState(emptyForm);
  const produtos = React.useSyncExternalStore(produtosStore.subscribe, produtosStore.getState);
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [produtoEmEdicao, setProdutoEmEdicao] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  useFocusEffect(
    useCallback(() => {
      setProdutoEmEdicao(null);
      setForm(emptyForm);
      setCadastroAberto(false);
      setBusca('');
    }, [])
  );

  const produtosFiltrados = produtos.filter((p) => 
    p.nome.toLowerCase().includes(busca.toLowerCase()) || 
    p.codigo.toLowerCase().includes(busca.toLowerCase())
  );

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
    if (!nome || nome.length < 2) {
      if (Platform.OS === 'web') window.alert('Validação: Nome do produto obrigatório (mín. 2 caracteres).');
      else Alert.alert('Validação', 'Nome do produto obrigatório (mín. 2 caracteres).');
      return;
    }

    const precoVenda = parseMoney(form.precoVenda);
    if (precoVenda <= 0) {
      if (Platform.OS === 'web') window.alert('Validação: Informe um preço de venda válido (maior que zero).');
      else Alert.alert('Validação', 'Informe um preço de venda válido (maior que zero).');
      return;
    }

    const custoRaw = form.precoCusto.trim();
    const precoCusto = custoRaw ? parseMoney(custoRaw) : 0;

    const estoqueRaw = form.estoque.trim();
    const estoque = estoqueRaw ? parseFloat(estoqueRaw.replace(',', '.')) || 0 : 0;
    if (estoque < 0) {
      if (Platform.OS === 'web') window.alert('Validação: Estoque não pode ser negativo.');
      else Alert.alert('Validação', 'Estoque não pode ser negativo.');
      return;
    }

    if (produtoEmEdicao) {
      await produtosStore.updateProduto(produtoEmEdicao, {
        nome,
        codigo: form.codigo.trim(),
        precoVenda,
        precoCusto: precoCusto > 0 ? precoCusto : null,
        unidade: (form.unidade.trim() || 'UN').toUpperCase().slice(0, 6),
        estoque,
        categoria: form.categoria.trim() || 'Geral',
        observacoes: form.observacoes.trim(),
      });
      if (Platform.OS === 'web') window.alert(`${nome} foi atualizado no catálogo.`);
      else Alert.alert('Produto atualizado', `${nome} foi atualizado no catálogo.`);
    } else {
      const result = await produtosStore.addProduto({
        nome,
        codigo: form.codigo.trim(),
        precoVenda,
        precoCusto: precoCusto > 0 ? precoCusto : null,
        unidade: (form.unidade.trim() || 'UN').toUpperCase().slice(0, 6),
        estoque,
        categoria: form.categoria.trim() || 'Geral',
        observacoes: form.observacoes.trim(),
      });
      if (!result.ok) {
        if (Platform.OS === 'web') window.alert(`Erro: ${result.msg}`);
        else Alert.alert('Erro', result.msg);
        return;
      }
      if (Platform.OS === 'web') window.alert(`${nome} foi adicionado ao catálogo.`);
      else Alert.alert('Produto cadastrado', `${nome} foi adicionado ao catálogo.`);
    }

    setForm(emptyForm);
    setProdutoEmEdicao(null);
    setCadastroAberto(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [form, produtoEmEdicao]);

  const remover = useCallback(async (id: string) => {
    await produtosStore.removeProduto(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const editar = useCallback((p: ProdutoCadastro) => {
    setProdutoEmEdicao(p.id);
    setForm({
      nome: p.nome,
      codigo: p.codigo,
      precoVenda: p.precoVenda.toString().replace('.', ','),
      precoCusto: p.precoCusto ? p.precoCusto.toString().replace('.', ',') : '',
      unidade: p.unidade,
      estoque: p.estoque.toString(),
      categoria: p.categoria,
      observacoes: p.observacoes,
    });
    setCadastroAberto(true);
  }, []);

  const abrirNovo = useCallback(() => {
    setProdutoEmEdicao(null);
    setForm(emptyForm);
    setCadastroAberto(true);
  }, []);

  const fecharCadastro = useCallback(() => {
    setCadastroAberto(false);
    setProdutoEmEdicao(null);
    setForm(emptyForm);
  }, []);

  const imprimirEtiqueta = useCallback((p: ProdutoCadastro) => {
    if (Platform.OS === 'web') {
      const cfg = configStore.getState();
      const largura = cfg.etiquetaLargura || 50;
      const altura = cfg.etiquetaAltura || 30;

      const w = window.open('', '_blank');
      if (w) {
        w.document.write(`
          <html>
            <head>
              <title>Etiqueta - ${p.nome}</title>
              <style>
                @page { margin: 0; size: ${largura}mm ${altura}mm; }
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                  margin: 0; 
                  padding: 2mm; 
                  width: ${largura}mm; 
                  height: ${altura}mm; 
                  text-align: center; 
                  box-sizing: border-box; 
                  display: flex; 
                  flex-direction: column; 
                  justify-content: center; 
                  align-items: center; 
                  overflow: hidden;
                }
                .name { 
                  font-size: 11px; 
                  font-weight: bold; 
                  margin-bottom: 1px; 
                  overflow: hidden; 
                  text-overflow: ellipsis; 
                  white-space: nowrap; 
                  width: 100%; 
                  line-height: 1.2; 
                }
                .price { 
                  font-size: 15px; 
                  font-weight: 900; 
                  margin: 1px 0; 
                }
                #barcode {
                  max-width: 95%;
                  height: auto;
                  max-height: ${altura * 0.35}mm;
                  margin: 1px 0;
                }
                .code { 
                  font-size: 9px; 
                  color: #333; 
                  margin-top: 1px; 
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  width: 100%;
                }
              </style>
            </head>
            <body>
              <div class="name">${p.nome}</div>
              <div class="price">${formatMoney(p.precoVenda)}</div>
              <svg id="barcode"></svg>
              <div class="code">Cód: ${p.codigo || p.id.slice(0, 6)}</div>
              
              <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
              <script>
                try {
                  const code = "${p.codigo || p.id.slice(0, 6)}";
                  JsBarcode("#barcode", code, {
                    format: "CODE128",
                    width: 2,
                    height: 40,
                    displayValue: false,
                    margin: 0
                  });
                } catch (e) {
                  console.error("Erro ao gerar codigo de barras:", e);
                  document.getElementById("barcode").style.display = "none";
                }
                setTimeout(() => { window.print(); window.close(); }, 400);
              </script>
            </body>
          </html>
        `);
        w.document.close();
      }
    } else {
      Alert.alert('Impressão', 'A impressão de etiquetas está disponível no terminal Web/PC.');
    }
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
                Produtos
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                Cadastro de produtos do sistema
              </Text>
            </View>
            <TouchableOpacity
              onPress={abrirNovo}
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
              <PackagePlus size={18} color={colors.accent} />
              <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Novo</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 12 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>
              Produtos cadastrados ({produtos.length})
            </Text>
            {/* Barra de pesquisa */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#0f172a' : '#f1f5f9', borderRadius: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.border, width: 250 }}>
              <Search size={16} color={colors.textSecondary} />
              <TextInput
                value={busca}
                onChangeText={setBusca}
                placeholder="Buscar produto..."
                placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                style={{ flex: 1, paddingVertical: 6, paddingHorizontal: 8, fontSize: 13, color: colors.textPrimary }}
              />
              {busca.length > 0 && (
                <TouchableOpacity onPress={() => setBusca('')} hitSlop={8}>
                  <X size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {produtosFiltrados.length === 0 ? (
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
                Nenhum produto cadastrado. Clique em &quot;Novo&quot; para adicionar.
              </Text>
            </View>
          ) : (
            <View style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              {/* Cabeçalho */}
              <View style={[styles.tableRow, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
                <Text style={[styles.tableHeader, { color: colors.textSecondary, flex: 3 }]}>Nome / Código</Text>
                <Text style={[styles.tableHeader, { color: colors.textSecondary, flex: 2 }]}>Categoria</Text>
                <Text style={[styles.tableHeader, { color: colors.textSecondary, flex: 2 }]}>Venda</Text>
                <Text style={[styles.tableHeader, { color: colors.textSecondary, flex: 2 }]}>Custo</Text>
                <Text style={[styles.tableHeader, { color: colors.textSecondary, flex: 2 }]}>Estoque</Text>
                <Text style={[styles.tableHeader, { color: colors.textSecondary, flex: 2 }]}>Cadastrado</Text>
                <View style={{ width: 100 }} />
              </View>
              {/* Linhas */}
              {produtosFiltrados.map((p, index) => (
                <View
                  key={p.id}
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
                  {/* Nome + código */}
                  <View style={{ flex: 3, paddingRight: 4 }}>
                    <Text style={[styles.tableCell, { color: colors.textHeader, fontWeight: '600' }]} numberOfLines={1}>
                      {p.nome}
                    </Text>
                    {!!p.codigo && (
                      <Text style={[styles.tableCellSub, { color: colors.textSecondary }]} numberOfLines={1}>
                        {p.codigo}
                      </Text>
                    )}
                  </View>
                  {/* Categoria */}
                  <Text style={[styles.tableCell, { color: colors.textSecondary, flex: 2 }]} numberOfLines={1}>
                    {p.categoria || '—'}
                  </Text>
                  {/* Preço venda */}
                  <Text style={[styles.tableCell, { color: colors.accent, fontWeight: '700', flex: 2 }]} numberOfLines={1}>
                    {formatMoney(p.precoVenda)}
                  </Text>
                  {/* Custo */}
                  <Text style={[styles.tableCell, { color: colors.textSecondary, flex: 2 }]} numberOfLines={1}>
                    {p.precoCusto != null ? formatMoney(p.precoCusto) : '—'}
                  </Text>
                  {/* Estoque */}
                  <Text style={[styles.tableCell, { color: colors.textHeader, flex: 2 }]} numberOfLines={1}>
                    {p.estoque} {p.unidade}
                  </Text>
                  {/* Data */}
                  <Text style={[styles.tableCell, { color: colors.textSecondary, flex: 2 }]} numberOfLines={1}>
                    {p.criadoEm}
                  </Text>
                  {/* Ações */}
                  <View style={{ width: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                    <TouchableOpacity
                      onPress={() => imprimirEtiqueta(p)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[styles.actionBtn, { backgroundColor: `${colors.accent}15` }]}
                    >
                      <Printer size={14} color={colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => editar(p)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.actionBtn}
                    >
                      <Pencil size={14} color={colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => remover(p.id)}
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
          <Pressable
            style={styles.backdrop}
            onPress={fecharCadastro}
            accessibilityRole="button"
            accessibilityLabel="Fechar cadastro de produto"
          />
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
                  <PackagePlus size={20} color={colors.accent} />
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textHeader }}>
                    {produtoEmEdicao ? 'Editar Produto' : 'Novo Produto'}
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
                <Text style={labelStyle}>Nome do produto *</Text>
                <TextInput
                  value={form.nome}
                  onChangeText={(t) => update('nome', t)}
                  placeholder="Ex.: Refrigerante 2L"
                  placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                  style={inputStyle}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Código / SKU</Text>
                    <TextInput
                      value={form.codigo}
                      onChangeText={(t) => update('codigo', t)}
                      placeholder="Opcional"
                      placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                      style={inputStyle}
                    />
                  </View>
                  <View style={{ width: 88 }}>
                    <Text style={labelStyle}>Unidade</Text>
                    <TextInput
                      value={form.unidade}
                      onChangeText={(t) => update('unidade', t.toUpperCase())}
                      placeholder="UN"
                      placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                      maxLength={6}
                      style={inputStyle}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Preço de venda *</Text>
                    <TextInput
                      value={form.precoVenda}
                      onChangeText={(t) => update('precoVenda', t)}
                      placeholder="0,00"
                      placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                      keyboardType="decimal-pad"
                      style={inputStyle}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Preço de custo</Text>
                    <TextInput
                      value={form.precoCusto}
                      onChangeText={(t) => update('precoCusto', t)}
                      placeholder="Opcional"
                      placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                      keyboardType="decimal-pad"
                      style={inputStyle}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Estoque inicial</Text>
                    <TextInput
                      value={form.estoque}
                      onChangeText={(t) => update('estoque', t)}
                      placeholder="0"
                      placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                      keyboardType="number-pad"
                      style={inputStyle}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Categoria</Text>
                    <TextInput
                      value={form.categoria}
                      onChangeText={(t) => update('categoria', t)}
                      placeholder="Ex.: Bebidas"
                      placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                      style={inputStyle}
                    />
                  </View>
                </View>

                <Text style={labelStyle}>Observações</Text>
                <TextInput
                  value={form.observacoes}
                  onChangeText={(t) => update('observacoes', t)}
                  placeholder="Detalhes adicionais (opcional)"
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
                    <Text style={styles.saveBtnText}>{produtoEmEdicao ? 'Atualizar produto' : 'Salvar produto'}</Text>
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
