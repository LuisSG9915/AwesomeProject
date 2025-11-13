/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
  TouchableOpacity,
  Text,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './components/LoginScreen';
import SalesScreen from './components/SalesScreen';
import BillingScreen from './components/BillingScreen';
import PrecorteScreen from './components/PrecorteScreen';
import TraspasoRecepcionScreen from './components/TraspasoRecepcionScreen';
import ReporteVentasScreen from './components/ReporteVentasScreen';
import SyncService from './services/SyncService';
import ClienteGruposScreen from './components/ClienteGruposScreen';
// import SignalRService from './services/SignalRService';
import DataViewScreen from './components/DataViewScreen';
import PrinterSettingsScreen from './components/PrinterSettingsScreen';
import AuthService from './services/AuthService';
import FullSyncService, { SyncProgress } from './services/FullSyncService';
import SyncProgressModal from './components/SyncProgressModal';
import BluetoothPrinterService from './services/BluetoothPrinterService';
import 'react-native-devsettings';
// OR if you are using AsyncStorage
import 'react-native-devsettings/withAsyncStorage';
const Stack = createNativeStackNavigator();

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  useEffect(() => {
    // App initialization
    console.log('App initialized');
    
    // Conectar automáticamente a la última impresora usada
    BluetoothPrinterService.connectToSavedPrinter().catch(err => {
      console.log('No hay impresora guardada o no se pudo conectar:', err);
    });
  }, []);

  // useEffect(() => {
  //   SignalRService.conectar();
  //   return () => {
  //     SignalRService.desconectar();
  //   };
  // }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#1976D2',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Home"
            component={AppContent}
            options={{
              title: 'Panel Principal',
              headerLeft: () => null,
            }}
          />
          <Stack.Screen
            name="Sales"
            component={SalesScreen}
            options={{ title: ' Punto de Venta' }}
          />
          <Stack.Screen
            name="Billing"
            component={BillingScreen}
            options={{ title: ' Cobranza' }}
          />
          <Stack.Screen
            name="Precorte"
            component={PrecorteScreen}
            options={{ title: ' Precorte' }}
          />
          <Stack.Screen
            name="Traspaso"
            component={TraspasoRecepcionScreen}
            options={{ title: ' Recepción de Traspasos' }}
          />
          <Stack.Screen
            name="ReporteVentas"
            component={ReporteVentasScreen}
            options={{ title: ' Consulta a Ventas' }}
          />
          {/* <Stack.Screen
            name="ClienteGrupos"
            component={ClienteGruposScreen}
            options={{ title: ' Grupos de Clientes' }}
          /> */}
          <Stack.Screen
            name="DataView"
            component={DataViewScreen}
            options={{ title: '📊 Datos Sincronizados' }}
          />
          <Stack.Screen
            name="PrinterSettings"
            component={PrinterSettingsScreen}
            options={{ title: '🖨️ Configuración de Impresora' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

function AppContent({ navigation }: { navigation: any }) {
  const isDarkMode = useColorScheme() === 'dark';
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress[]>([]);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    const loadUserInfo = async () => {
      const user = await AuthService.restoreSession();
      if (user) {
        setUserName(user.claveEmpleado || 'Usuario');
      }
    };
    loadUserInfo();
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro de que deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: async () => {
          await AuthService.logout();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  }, [navigation]);

  const handleFullSync = useCallback(async () => {
    if (syncing) return;

    setSyncing(true);
    setSyncProgress([]);

    try {
      const user = await AuthService.restoreSession();
      const sucursal = user?.sucursal_origen || user?.sucursal || 1;

      await FullSyncService.syncAll(sucursal, (progress: SyncProgress) => {
        setSyncProgress(prev => [...prev, progress]);
      });

      await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));
      Alert.alert(
        '✅ Sincronización Completa',
        'Todos los datos han sido actualizados correctamente.',
      );
    } catch (error: any) {
      Alert.alert(
        '❌ Error de Sincronización',
        error?.message || 'No se pudo completar la sincronización',
      );
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  const menuItems = [
    {
      id: 'sales',
      title: 'Punto de Venta',
      icon: '🛒',
      color: '#9C27B0',
      gradient: ['#9C27B0', '#7B1FA2'],
      screen: 'Sales',
      description: 'Registra ventas y emite tickets',
    },
    {
      id: 'billing',
      title: 'Cobranza',
      icon: '💰',
      color: '#FF9800',
      gradient: ['#FF9800', '#F57C00'],
      screen: 'Billing',
      description: 'Gestiona pagos y facturas',
    },
    {
      id: 'precorte',
      title: 'Precorte',
      icon: '📋',
      color: '#607D8B',
      gradient: ['#607D8B', '#455A64'],
      screen: 'Precorte',
      description: 'Revisa el corte del día',
    },
    {
      id: 'traspaso',
      title: 'Recepción de Traspasos',
      icon: '🚚',
      color: '#3F51B5',
      gradient: ['#3F51B5', '#303F9F'],
      screen: 'Traspaso',
      description: 'Recibe mercancía en tránsito',
    },
    {
      id: 'reporte',
      title: 'Consulta a Ventas',
      icon: '📈',
      color: '#009688',
      gradient: ['#009688', '#00796B'],
      screen: 'ReporteVentas',
      description: 'Consulta histórico de ventas',
    },
    {
      id: 'grupos',
      title: 'Grupos de Clientes',
      icon: '👥',
      color: '#3949AB',
      gradient: ['#3949AB', '#283593'],
      screen: 'ClienteGrupos',
      description: 'Administra catálogos en Realm',
    },
    {
      id: 'dataview',
      title: 'Datos Sincronizados',
      icon: '📊',
      color: '#00897B',
      gradient: ['#00897B', '#00695C'],
      screen: 'DataView',
      description: 'Visualiza datos almacenados localmente',
    },
    {
      id: 'printersettings',
      title: 'Configuración de Impresora',
      icon: '🖨️',
      color: '#5E35B1',
      gradient: ['#5E35B1', '#4527A0'],
      screen: 'PrinterSettings',
      description: 'Configura impresora de tickets Bluetooth',
    },
  ];

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.welcomeText}>Bienvenido</Text>
                <Text style={styles.businessName}>Sistema de Gestión</Text>
                <Text style={styles.userName}>👤 {userName}</Text>
              </View>
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <Text style={styles.logoutIcon}>🚪</Text>
                <Text style={styles.logoutText}>Salir</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>
              Selecciona un módulo para comenzar
            </Text>
          </View>
        </View>

        {/* Menu Grid */}
        <View style={styles.menuGrid}>
          {menuItems.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuCard, { backgroundColor: item.color }]}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.8}
            >
              <View style={styles.menuCardContent}>
                <View style={styles.iconContainer}>
                  <Text style={styles.menuIcon}>{item.icon}</Text>
                </View>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuDescription}>{item.description}</Text>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.cardFooterText}>Abrir →</Text>
              </View>
            </TouchableOpacity>
          ))}

          {/* Sync Button */}
          <TouchableOpacity
            style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
            onPress={handleFullSync}
            disabled={syncing}
            activeOpacity={0.85}
          >
            <View style={styles.syncButtonContent}>
              <Text style={styles.syncButtonIcon}>🔄</Text>
              <Text style={styles.syncButtonText}>
                {syncing
                  ? 'Sincronizando datos...'
                  : 'Sincronizar Todos los Datos'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Footer Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Sistema de Gestión v1.0.0</Text>
          <Text style={styles.footerSubtext}>Desarrollado con ❤️</Text>
        </View>
      </ScrollView>

      <SyncProgressModal visible={syncing} progress={syncProgress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  containerDark: {
    backgroundColor: '#121212',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  header: {
    backgroundColor: '#1976D2',
    paddingTop: 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  headerContent: {
    width: '100%',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 16,
    color: '#E3F2FD',
    fontWeight: '500',
  },
  businessName: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 4,
  },
  userName: {
    fontSize: 14,
    color: '#E3F2FD',
    fontWeight: '600',
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoutIcon: {
    fontSize: 18,
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    color: '#E3F2FD',
    marginTop: 8,
    textAlign: 'center',
  },
  menuGrid: {
    padding: 16,
    gap: 16,
  },
  menuCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    minHeight: 140,
  },
  menuCardContent: {
    flex: 1,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  menuIcon: {
    fontSize: 32,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  menuDescription: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.9,
    lineHeight: 18,
  },
  syncButton: {
    backgroundColor: '#1565C0',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  syncButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#90A4AE',
  },
  syncButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  syncButtonIcon: {
    fontSize: 24,
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardFooterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  footer: {
    paddingVertical: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  footerText: {
    color: '#999',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  footerSubtext: {
    color: '#BBB',
    fontSize: 11,
  },
});

export default App;
