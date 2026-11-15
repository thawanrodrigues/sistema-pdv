import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { 
  Users, 
  Package, 
  ShoppingCart, 
  Calculator, 
  DollarSign, 
  Settings, 
  Headset,
  Search,
  LogOut,
  FileText,
} from 'lucide-react-native';
import { useTheme } from '../ui/themes/index.theme';
import { authStore } from '../store/authStore';

export function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();
  const isAdmin = authStore.isAdmin();

  const allMenuItems = [
    { icon: Users,       label: 'Clientes',      route: '/clientes',      adminOnly: true  },
    { icon: Package,     label: 'Produto',        route: '/produtos',      adminOnly: true  },
    { icon: ShoppingCart, label: 'Terminal Venda', route: '/terminal',      adminOnly: false },
    { icon: Calculator,  label: 'Caixa',          route: '/caixa',         adminOnly: true  },
    { icon: DollarSign,  label: 'Financeiro',     route: '/financeiro',    adminOnly: true  },
    { icon: FileText,    label: 'Notas Fiscais',  route: '/notas',         adminOnly: true  },
    { icon: Settings,    label: 'Config. Gerais', route: '/config',        adminOnly: true  },
    { icon: Headset,     label: 'Suporte',        route: '/suporte',       adminOnly: true  },
  ];

  const menuItems = isAdmin ? allMenuItems : allMenuItems.filter((i) => !i.adminOnly);

  const handleLogout = () => {
    router.replace('/login' as any);
  };

  return (
    <View style={{ 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      backgroundColor: colors.headerBackground,
      borderBottomWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 8,
      zIndex: 10
    }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity 
            onPress={() => router.push('/')}
            style={{ padding: 8, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}
          >
            <Text style={{ fontWeight: 'bold', color: colors.accent, fontSize: 16 }}>CS</Text>
          </TouchableOpacity>
          
          {menuItems.map((item, index) => {
            const isActive = pathname === item.route;
            const Icon = item.icon;
            return (
              <TouchableOpacity 
                key={index} 
                onPress={() => router.push(item.route as any)}
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: isActive ? colors.border : 'transparent',
                  minWidth: 80,
                }}
              >
                <Icon size={24} color={isActive ? colors.accent : colors.textHeader} style={{ marginBottom: 4 }} />
                <Text style={{ 
                  color: isActive ? colors.accent : colors.textHeader, 
                  fontSize: 12, 
                  fontWeight: isActive ? '600' : '400' 
                }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Search size={20} color={colors.textHeader} />
        </TouchableOpacity>

        {/* Botão discreto de Sair */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: colors.accent + '50',
            marginLeft: 4,
          }}
        >
          <LogOut size={13} color={colors.accent} />
          <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '600' }}>Sair</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
