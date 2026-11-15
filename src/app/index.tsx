import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../ui/themes/index.theme';
import Animated, { FadeInUp, FadeInDown, withRepeat, withTiming, withSequence } from 'react-native-reanimated';

export default function Dashboard() {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      
      {/* Background abstract elements simulation */}
      <View style={{ 
        position: 'absolute', top: -50, right: -50, 
        width: 300, height: 300, borderRadius: 150, 
        backgroundColor: 'rgba(255,255,255,0.03)' 
      }} />
      <View style={{ 
        position: 'absolute', bottom: -100, left: -50, 
        width: 400, height: 400, borderRadius: 200, 
        backgroundColor: 'rgba(255,255,255,0.02)' 
      }} />

      {/* Background Image - Conecta Globe */}
      <Image
        source={require('../../assets/images/conecta_globe.png')}
        style={{
          ...StyleSheet.absoluteFillObject,
          width: '100%',
          height: '100%',
          resizeMode: 'cover',
          opacity: 0.25,
        }}
      />

      <Animated.View entering={FadeInUp.duration(1000).springify()} style={{ alignItems: 'center', zIndex: 10 }}>
        <Text style={{ 
          fontSize: 80, 
          fontWeight: '900', 
          color: '#ffffff', // As requested: letras devem ser na cor branca
          letterSpacing: -2,
          textShadowColor: 'rgba(0,0,0,0.5)',
          textShadowOffset: { width: 2, height: 4 },
          textShadowRadius: 6
        }}>
          CONECTA SISTEMAS
        </Text>
        
        <Animated.Text entering={FadeInDown.delay(300).duration(800)} style={{ 
          fontSize: 24, 
          fontWeight: '700', 
          color: colors.accent, 
          marginTop: -10,
          letterSpacing: 2
        }}>
          SOLUÇÕES PARA SUA EMPRESA!
        </Animated.Text>
        
        <Animated.Text entering={FadeInDown.delay(600).duration(800)} style={{ 
          fontSize: 16, 
          fontWeight: '500', 
          color: 'rgba(255,255,255,0.7)', 
          marginTop: 10 
        }}>
          Bem Vindo ao Sistema
        </Animated.Text>
      </Animated.View>
    </View>
  );
}
