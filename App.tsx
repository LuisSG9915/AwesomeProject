/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
  TouchableOpacity,
  Text,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { Icon } from 'react-native-elements';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './components/LoginScreen';
import SalesScreen from './components/SalesScreen';
import BillingScreen from './components/BillingScreen';
import PrecorteScreen from './components/PrecorteScreen';
import TraspasoRecepcionScreen from './components/TraspasoRecepcionScreen';
import ReporteVentasScreen from './components/ReporteVentasScreen';
// import SignalRService from './services/SignalRService';
import DataViewScreen from './components/DataViewScreen';
import PrinterSettingsScreen from './components/PrinterSettingsScreen';
import AuthService from './services/AuthService';
import FullSyncService from './services/FullSyncService';
import { SyncProgress } from './services/sync/SyncTask';
import SyncProgressModal from './components/SyncProgressModal';
import BluetoothPrinterService from './services/BluetoothPrinterService';
import BackgroundSyncService from './services/BackgroundSyncService';
import SyncStatusPanel from './components/SyncStatusPanel';
import { bitacoraService } from './services/BitacoraService';
import TrazabilidadService from './services/TrazabilidadService';
import NotificationPermissionService from './services/NotificationPermissionService';
import {
  APP_NAME,
  COLORS,
  SPACING,
  SHADOWS,
  BORDER_RADIUS,
  TYPOGRAPHY,
} from './theme/theme';
import 'react-native-devsettings';
// OR if you are using AsyncStorage
import 'react-native-devsettings/withAsyncStorage';

declare const global: any;

declare global {
  // eslint-disable-next-line no-var
  var consoleRealm: (label: string, value: any, limit?: number) => void;
}

if (__DEV__) {
  (global as any).consoleRealm = (
    label: string,
    value: any,
    limit: number = 20,
  ) => {
    try {
      if (!value) {
        console.log(`${label}: <empty>`, value);
        return;
      }

      const isArrayLike =
        Array.isArray(value) || typeof (value as any).length === 'number';

      const arr = isArrayLike
        ? Array.from(value as any).slice(0, limit)
        : [value];
      const plain = JSON.parse(JSON.stringify(arr));
      console.log(`${label} (${plain.length})`, plain);
    } catch (error) {
      console.log(`${label} (raw, error al convertir)`, value, error);
    }
  };
}

const Stack = createNativeStackNavigator();

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const navigationRef = useRef<any>(null);
  const routeNameRef = useRef<string | null>(null);

  useEffect(() => {
    // App initialization
    console.log('App initialized');

    // Conectar automáticamente a la última impresora usada
    BluetoothPrinterService.connectToSavedPrinter().catch(err => {
      console.log('No hay impresora guardada o no se pudo conectar:', err);
    });

    (async () => {
      try {
        await FullSyncService.initialize();
      } catch (error) {
        console.warn('[App] No se pudo inicializar FullSyncService:', error);
        return;
      }

      try {
        await TrazabilidadService.initialize();
        console.log('[App] ✅ TrazabilidadService inicializado');
      } catch (error) {
        console.warn(
          '[App] No se pudo inicializar TrazabilidadService:',
          error,
        );
      }

      try {
        await bitacoraService.iniciarSesionApp({
          appState: AppState.currentState,
          pantalla: null,
        });
      } catch (error) {
        console.warn('[App] No se pudo iniciar sesión de app:', error);
      }
    })();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      bitacoraService.registrarCambioAppState(nextState);
    });

    return () => {
      subscription.remove();
    };
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
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          const currentRouteName =
            navigationRef.current?.getCurrentRoute?.()?.name || null;
          routeNameRef.current = currentRouteName;
          bitacoraService
            .iniciarSesionApp({
              appState: AppState.currentState,
              pantalla: currentRouteName,
            })
            .catch(() => undefined);
          if (currentRouteName) {
            bitacoraService.registrarCambioPantalla(currentRouteName);
          }
        }}
        onStateChange={() => {
          const currentRouteName =
            navigationRef.current?.getCurrentRoute?.()?.name || null;
          if (currentRouteName && routeNameRef.current !== currentRouteName) {
            bitacoraService.registrarCambioPantalla(currentRouteName);
            routeNameRef.current = currentRouteName;
          }
        }}
      >
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerStyle: {
              backgroundColor: COLORS.primary,
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
    const initializeApp = async () => {
      // 1. Cargar información de usuario
      const user = await AuthService.restoreSession();
      if (user) {
        setUserName(user.claveEmpleado || 'Usuario');

        // Configurar contexto de usuario en TrazabilidadService
        TrazabilidadService.setCurrentUser({
          id: user.id || user.idUsuario || 0,
          nombre: user.nombre || user.claveEmpleado || 'Usuario',
          sucursal: user.sucursal_origen || user.sucursal || 1,
        });
        console.log(
          '[App] ✅ Contexto de usuario configurado en TrazabilidadService',
        );
      }

      // 2. IMPORTANTE: Solicitar permisos de notificaciones ANTES de iniciar sync en background
      // Esto evita que la app crashee en Android 13+ cuando intenta mostrar notificaciones
      console.log('[App] 🔔 Solicitando permisos de notificaciones...');
      try {
        await NotificationPermissionService.requestNotificationPermission(true);
        console.log('[App] ✅ Permisos de notificaciones procesados');
      } catch (error) {
        console.warn(
          '[App] ⚠️ Error solicitando permisos (no crítico):',
          error,
        );
      }

      // 3. Iniciar sincronización automática
      // Si no hay permisos, ForegroundService no iniciará pero la app seguirá funcionando
      // DESHABILITADO: Usando Tasker para sincronización en segundo plano
      // console.log('[App] 🚀 Iniciando BackgroundSyncService...');
      // BackgroundSyncService.start();
    };

    initializeApp();

    // Detener sincronización al desmontar
    // DESHABILITADO: BackgroundSyncService no se está usando
    // return () => {
    //   BackgroundSyncService.stop();
    // };
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro de que deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: async () => {
          try {
            await bitacoraService.registrarEventoApp({
              tipo: 'logout',
              accion: 'logout',
              descripcion: 'Cerrar sesión',
            });
          } catch (error) {
            console.warn('[App] No se pudo registrar evento logout:', error);
          }
          await AuthService.logout();
          bitacoraService.clearUserContext();
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
      try {
        await bitacoraService.registrarEventoApp({
          tipo: 'sync_manual',
          accion: 'start',
          descripcion: 'Sincronización manual iniciada',
        });
      } catch (error) {
        console.warn('[App] No se pudo registrar evento sync start:', error);
      }

      const user = await AuthService.restoreSession();
      const sucursal = user?.sucursal_origen || user?.sucursal || 1;

      await FullSyncService.syncAll(sucursal, (progress: SyncProgress) => {
        setSyncProgress(prev => [...prev, progress]);
      });

      // Mantener el modal visible 2 segundos después de terminar
      await new Promise<void>(resolve => setTimeout(resolve, 2000));
      Alert.alert(
        '✅ Sincronización Completa',
        'Todos los datos han sido actualizados correctamente.',
      );

      try {
        await bitacoraService.registrarEventoApp({
          tipo: 'sync_manual',
          accion: 'success',
          descripcion: 'Sincronización manual exitosa',
        });
      } catch (error) {
        console.warn('[App] No se pudo registrar evento sync success:', error);
      }
    } catch (error: any) {
      Alert.alert(
        '❌ Error de Sincronización',
        error?.message || 'No se pudo completar la sincronización',
      );

      try {
        await bitacoraService.registrarEventoApp({
          tipo: 'sync_manual',
          accion: 'error',
          descripcion: error?.message || 'Error en sincronización manual',
        });
      } catch (logError) {
        console.warn('[App] No se pudo registrar evento sync error:', logError);
      }
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  const menuItems = [
    {
      id: 'sales',
      title: 'Punto de Venta',
      icon: 'shopping-cart',
      type: 'material',
      color: COLORS.cards.sales,
      screen: 'Sales',
      description: 'Registra ventas',
    },
    {
      id: 'billing',
      title: 'Cobranza',
      icon: 'attach-money',
      type: 'material',
      color: COLORS.cards.billing,
      screen: 'Billing',
      description: 'Gestiona pagos',
    },
    {
      id: 'precorte',
      title: 'Precorte',
      icon: 'assignment',
      type: 'material',
      color: COLORS.cards.precorte,
      screen: 'Precorte',
      description: 'Revisa el corte',
    },
    {
      id: 'traspaso',
      title: 'Traspasos',
      icon: 'local-shipping',
      type: 'material',
      color: COLORS.cards.traspaso,
      screen: 'Traspaso',
      description: 'Recibe mercancía',
    },
    {
      id: 'reporte',
      title: 'Ventas',
      icon: 'trending-up',
      type: 'material',
      color: COLORS.cards.report,
      screen: 'ReporteVentas',
      description: 'Histórico ventas',
    },
    {
      id: 'dataview',
      title: 'Datos',
      icon: 'bar-chart',
      type: 'material',
      color: COLORS.cards.data,
      screen: 'DataView',
      description: 'Datos locales',
    },
    {
      id: 'printersettings',
      title: 'Impresora',
      icon: 'print',
      type: 'material',
      color: COLORS.cards.settings,
      screen: 'PrinterSettings',
      description: 'Configurar',
    },
  ];

  const [User, setUser] = useState(0);

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Panel de estado de sincronización */}
        <SyncStatusPanel />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.welcomeText}>Bienvenido</Text>
              <Text style={styles.businessName}>{APP_NAME}</Text>
              <View style={styles.userBadge}>
                <Icon
                  name="person"
                  type="material"
                  size={14}
                  color={COLORS.primary}
                />
                <Text style={styles.userName}>{userName}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Icon name="logout" type="material" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu Grid */}
        <View style={styles.menuGrid}>
          {menuItems.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuCard, { backgroundColor: item.color }]}
              onPress={() => {
                try {
                  void bitacoraService.registrarEventoApp({
                    tipo: 'navigate',
                    accion: item.screen,
                    descripcion: item.title,
                    detalles: {
                      menuItemId: item.id,
                    },
                  });
                } catch (error) {
                  console.warn(
                    '[App] No se pudo registrar evento navigate:',
                    error,
                  );
                }
                navigation.navigate(item.screen);
              }}
              activeOpacity={0.9}
            >
              <View style={styles.iconContainer}>
                <Icon
                  name={item.icon}
                  type={item.type}
                  color={item.color}
                  size={28}
                />
              </View>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuDescription}>{item.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sync Button */}
        <View style={styles.syncContainer}>
          <TouchableOpacity
            style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
            onPress={handleFullSync}
            disabled={syncing}
            activeOpacity={0.85}
          >
            <Icon
              name="sync"
              type="material"
              size={24}
              color="#fff"
              style={syncing ? styles.spinning : {}}
            />
            <Text style={styles.syncButtonText}>
              {syncing ? 'Sincronizando...' : 'Sincronizar Datos'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{APP_NAME} v1.0.0</Text>
        </View>
      </ScrollView>

      <SyncProgressModal visible={syncing} progress={syncProgress} />
    </View>
  );
}

const { width } = Dimensions.get('window');
const cardWidth = (width - SPACING.m * 3) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  containerDark: {
    backgroundColor: '#121212',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xl,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.l + 20, // Extra padding for overlap
    paddingHorizontal: SPACING.l,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...SHADOWS.large,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  welcomeText: {
    ...TYPOGRAPHY.body,
    color: COLORS.primaryLight,
    marginBottom: SPACING.xs,
  },
  businessName: {
    ...TYPOGRAPHY.h1,
    color: '#fff',
    fontSize: 26,
    marginBottom: SPACING.s,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
    alignSelf: 'flex-start',
    gap: SPACING.xs,
  },
  userName: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: SPACING.s,
    borderRadius: BORDER_RADIUS.m,
  },
  menuGrid: {
    paddingHorizontal: SPACING.m,
    marginTop: -20, // Overlap header
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SPACING.m,
  },
  menuCard: {
    width: cardWidth,
    borderRadius: BORDER_RADIUS.l,
    padding: SPACING.m,
    height: 150,
    justifyContent: 'space-between',
    ...SHADOWS.medium,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: BORDER_RADIUS.m,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    ...TYPOGRAPHY.h3,
    color: '#fff',
    fontSize: 18,
    marginTop: SPACING.s,
  },
  menuDescription: {
    ...TYPOGRAPHY.caption,
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
  },
  syncContainer: {
    padding: SPACING.m,
    marginTop: SPACING.m,
  },
  syncButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.l,
    paddingVertical: SPACING.m,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.s,
    ...SHADOWS.medium,
  },
  syncButtonDisabled: {
    opacity: 0.7,
    backgroundColor: COLORS.muted,
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  spinning: {
    // Note: Animation would need Animated API, but for now we keep it static
  },
  footer: {
    alignItems: 'center',
    paddingVertical: SPACING.l,
  },
  footerText: {
    color: COLORS.muted,
    fontSize: 12,
  },
});

export default App;
