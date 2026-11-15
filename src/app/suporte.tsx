import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  StyleSheet,
  Alert,
  Linking
} from 'react-native';
import { useTheme } from '../ui/themes/index.theme';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Headset, MessageCircle, Send, HelpCircle, ChevronRight } from 'lucide-react-native';

export default function SuporteScreen() {
  const { colors, isDark } = useTheme();

  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');

  const enviarChamado = () => {
    if (!assunto.trim() || !mensagem.trim()) {
      Alert.alert('Atenção', 'Por favor, preencha o assunto e a mensagem para abrir o chamado.');
      return;
    }

    const telefone = '5599992200497';
    const texto = `*Novo Chamado de Suporte - Conecta PDV*\n\n*Assunto:* ${assunto.trim()}\n*Mensagem:* ${mensagem.trim()}`;
    const url = `https://wa.me/${telefone}?text=${encodeURIComponent(texto)}`;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    
    Linking.openURL(url).then(() => {
      setAssunto('');
      setMensagem('');
    }).catch(() => {
      Alert.alert('Erro', 'Não foi possível enviar a mensagem para o WhatsApp.');
    });
  };

  const abrirWhatsApp = () => {
    const telefone = '5599992200497';
    Linking.openURL(`https://wa.me/${telefone}?text=Olá, preciso de suporte no Conecta Sistemas PDV.`).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o WhatsApp.');
    });
  };

  const inputStyle = {
    backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
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

  const faqs = [
    { pergunta: 'Como realizar o fechamento de caixa?', resposta: 'Acesse a aba Caixa, verifique se todos os lançamentos foram feitos e clique em "Fechar Caixa".' },
    { pergunta: 'Posso usar o sistema offline?', resposta: 'O PDV requer conexão com a internet para sincronizar vendas, mas funciona de forma contingente em quedas curtas.' },
    { pergunta: 'Como configuro uma nova impressora?', resposta: 'Vá em "Config. Gerais" > Ponto de Venda e informe o modelo da sua impressora configurada no sistema.' }
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 32 }}>
            <View style={{ padding: 12, backgroundColor: colors.accent + '20', borderRadius: 12 }}>
              <Headset size={32} color={colors.accent} />
            </View>
            <View>
              <Text style={{ fontSize: 26, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 4 }}>
                Central de Suporte
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                Como podemos ajudar você hoje?
              </Text>
            </View>
          </View>

          {/* Os dois cards lado a lado */}
          <View style={{ flexDirection: Platform.OS === 'web' ? 'row' : 'column', gap: 24, marginBottom: 32, alignItems: 'stretch' }}>
            {/* Abrir Chamado (Formulário) */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Send size={20} color={colors.textPrimary} />
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>Abrir um Chamado</Text>
              </View>
              
              <View style={[styles.card, { backgroundColor: colors.headerBackground, borderColor: colors.border, flex: 1 }]}>
                <Text style={labelStyle}>Assunto</Text>
                <TextInput
                  value={assunto}
                  onChangeText={setAssunto}
                  placeholder="Do que se trata?"
                  placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                  style={inputStyle}
                />

                <Text style={labelStyle}>Sua Mensagem</Text>
                <TextInput
                  value={mensagem}
                  onChangeText={setMensagem}
                  placeholder="Descreva detalhadamente o seu problem ou dúvida..."
                  placeholderTextColor={isDark ? colors.textSecondary : '#94a3b8'}
                  multiline
                  numberOfLines={4}
                  style={[inputStyle, { minHeight: 100, textAlignVertical: 'top' }]}
                />

                <TouchableOpacity
                  onPress={enviarChamado}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: colors.accent,
                    paddingVertical: 14,
                    borderRadius: 10,
                    alignItems: 'center',
                    marginTop: 20
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Enviar Mensagem</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* FAQ */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <HelpCircle size={20} color={colors.textPrimary} />
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>Dúvidas Frequentes</Text>
              </View>

              <View style={[styles.card, { backgroundColor: colors.headerBackground, borderColor: colors.border, padding: 0, overflow: 'hidden', flex: 1 }]}>
                {faqs.map((faq, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={{ 
                      padding: 16, 
                      borderBottomWidth: index === faqs.length - 1 ? 0 : StyleSheet.hairlineWidth, 
                      borderBottomColor: colors.border 
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textHeader, flex: 1, paddingRight: 16 }}>
                        {faq.pergunta}
                      </Text>
                      <ChevronRight size={16} color={colors.textSecondary} />
                    </View>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8, lineHeight: 20 }}>
                      {faq.resposta}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Botão verde do WhatsApp abaixo e centralizado */}
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <TouchableOpacity 
              onPress={abrirWhatsApp} 
              style={[styles.contactCard, { 
                backgroundColor: '#25D366', 
                width: '100%', 
                maxWidth: 400, 
                justifyContent: 'center',
                flex: 0
              }]}
            >
              <MessageCircle size={24} color="#fff" />
              <View style={{ marginLeft: 12 }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>WhatsApp Suporte</Text>
                <Text style={{ color: '#ffffffcc', fontSize: 13 }}>Clique para iniciar atendimento rápido</Text>
              </View>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  contactCard: {
    flex: 1,
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  }
});
