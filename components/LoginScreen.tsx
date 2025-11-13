import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AuthService from '../services/AuthService';
import FullSyncService, { SyncProgress } from '../services/FullSyncService';
import SyncProgressModal from './SyncProgressModal';

export default function LoginScreen({ navigation }: any) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress[]>([]);

  useEffect(() => {
    console.log('Checking for existing session in LoginScreen');
    const checkSession = async () => {
      const session = await AuthService.restoreSession();
      if (session) {
        console.log('Session found, redirecting to Home');
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
      }
    };
    checkSession();
  }, [navigation]);

  const handleLogin = async () => {
    if (!usuario || !password) {
      Alert.alert('Campos requeridos', 'Ingresa usuario y contraseña');
      return;
    }
    console.log('Login attempt with user:', usuario);
    setLoading(true);
    try {
      await AuthService.login(usuario.trim(), password.trim());
      
      // Iniciar sincronización después del login exitoso
      setLoading(false);
      setSyncing(true);
      setSyncProgress([]);
      
      await FullSyncService.syncAll(1, (progress: SyncProgress) => {
        setSyncProgress(prev => [...prev, progress]);
      });
      
      // Esperar un momento para que el usuario vea que completó
      await new Promise<void>(resolve => setTimeout(() => resolve(), 1500));
      
      setSyncing(false);
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (err: any) {
      const msg = err?.message || 'Ocurrió un error al iniciar sesión';
      Alert.alert('No autorizado', msg);
      setSyncing(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inicio de Sesión</Text>

      <TextInput
        placeholder="Usuario"
        autoCapitalize="none"
        value={usuario}
        onChangeText={setUsuario}
        style={styles.input}
        editable={!loading}
        returnKeyType="next"
      />

      <TextInput
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        editable={!loading}
        returnKeyType="done"
        onSubmitEditing={handleLogin}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Ingresar</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.note}>
        Login solo online por ahora. IndexedDB/Realm pendiente.
      </Text>

      <SyncProgressModal visible={syncing} progress={syncProgress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#1976D2',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  note: {
    marginTop: 16,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
