/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect } from 'react';
import {
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
  TouchableOpacity,
  Text,
  ScrollView,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NewAppScreen } from '@react-native/new-app-screen';
import WebhookScreen from './components/WebhookScreen';
import ClientesTable from './components/ClientesTable';
import WebhookManager from './services/WebhookManager';
import SyncService from './services/SyncService';
import LoginScreen from './components/LoginScreen';
import SalesScreen from './components/SalesScreen';
import BillingScreen from './components/BillingScreen';
import PrecorteScreen from './components/PrecorteScreen';
import TraspasoRecepcionScreen from './components/TraspasoRecepcionScreen';
import ReporteVentasScreen from './components/ReporteVentasScreen';

const Stack = createNativeStackNavigator();

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  useEffect(() => {
    // Inicializar servicios al iniciar la app
    Promise.all([WebhookManager.initialize(), SyncService.initialize()]).catch(
      console.error,
    );
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login">
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ title: 'Iniciar Sesión' }}
          />
          <Stack.Screen
            name="Home"
            component={AppContent}
            options={{ title: 'Awesome App' }}
          />
          <Stack.Screen
            name="Sales"
            component={SalesScreen}
            options={{ title: 'Punto de Venta' }}
          />
          <Stack.Screen
            name="Billing"
            component={BillingScreen}
            options={{ title: 'Cobranza' }}
          />
          <Stack.Screen
            name="Precorte"
            component={PrecorteScreen}
            options={{ title: 'Precorte' }}
          />
          <Stack.Screen
            name="Traspaso"
            component={TraspasoRecepcionScreen}
            options={{ title: 'Recepción de Traspasos' }}
          />
          <Stack.Screen
            name="ReporteVentas"
            component={ReporteVentasScreen}
            options={{ title: 'Consulta a Ventas' }}
          />
          <Stack.Screen
            name="Webhooks"
            component={WebhookScreen}
            options={{ title: 'Webhooks Managers' }}
          />
          <Stack.Screen
            name="Clientes"
            component={ClientesTable}
            options={{ title: 'Clientes Sincronizados' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

function AppContent({ navigation }: { navigation: any }) {
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <NewAppScreen />

        {/* Botones de navegación */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.webhookButton}
            onPress={() => navigation.navigate('Webhooks')}
          >
            <Text style={styles.webhookButtonText}>📡 Gestionar Webhooks</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.clientesButton}
            onPress={() => navigation.navigate('Clientes')}
          >
            <Text style={styles.clientesButtonText}>👥 Ver Clientes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.salesButton}
            onPress={() => navigation.navigate('Sales')}
          >
            <Text style={styles.salesButtonText}>🧾 Punto de Venta</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.billingButton}
            onPress={() => navigation.navigate('Billing')}
          >
            <Text style={styles.billingButtonText}>💳 Cobranza</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.precorteButton}
            onPress={() => navigation.navigate('Precorte')}
          >
            <Text style={styles.precorteButtonText}>🧮 Precorte</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.traspasoButton}
            onPress={() => navigation.navigate('Traspaso')}
          >
            <Text style={styles.traspasoButtonText}>📦 Recepción de Traspasos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.reporteButton}
            onPress={() => navigation.navigate('ReporteVentas')}
          >
            <Text style={styles.reporteButtonText}>📊 Consulta a Ventas</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  buttonsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 20,
  },
  webhookButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 15,
  },
  webhookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  clientesButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  clientesButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  salesButton: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginTop: 15,
  },
  salesButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  billingButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginTop: 15,
  },
  billingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  precorteButton: {
    backgroundColor: '#607D8B',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginTop: 15,
    marginBottom: 20,
  },
  precorteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  traspasoButton: {
    backgroundColor: '#3F51B5',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginTop: 15,
    marginBottom: 30,
  },
  traspasoButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  reporteButton: {
    backgroundColor: '#009688',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginTop: 15,
    marginBottom: 40,
  },
  reporteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default App;
