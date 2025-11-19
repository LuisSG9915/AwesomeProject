import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Icon } from 'react-native-elements';
import AuthService from '../services/AuthService';
import FullSyncService, { SyncProgress } from '../services/FullSyncService';
import SyncProgressModal from './SyncProgressModal';
import {
  APP_NAME,
  COLORS,
  SPACING,
  SHADOWS,
  BORDER_RADIUS,
  TYPOGRAPHY,
} from '../theme/theme';

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

      // Mantener el modal visible 2 segundos después de terminar
      await new Promise<void>(resolve => setTimeout(resolve, 2000));

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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <View style={styles.logoContainer}>
            <Icon
              name="ac-unit"
              type="material"
              size={50}
              color={COLORS.primary}
            />
          </View>
          <Text style={styles.appName}>{APP_NAME}</Text>
          <Text style={styles.subtitle}>Bienvenido de nuevo</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Icon
              name="person-outline"
              type="material"
              size={24}
              color={COLORS.textSecondary}
              style={styles.inputIcon}
            />
            <TextInput
              placeholder="Usuario"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="none"
              value={usuario}
              onChangeText={setUsuario}
              style={styles.input}
              editable={!loading}
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputContainer}>
            <Icon
              name="lock-outline"
              type="material"
              size={24}
              color={COLORS.textSecondary}
              style={styles.inputIcon}
            />
            <TextInput
              placeholder="Contraseña"
              placeholderTextColor={COLORS.muted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.buttonText}>INGRESAR</Text>
                <Icon
                  name="arrow-forward"
                  type="material"
                  size={20}
                  color="#fff"
                />
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.note}>
            Login solo online por ahora. IndexedDB/Realm pendiente.
          </Text>
        </View>

        <SyncProgressModal visible={syncing} progress={syncProgress} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.l,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.m,
    ...SHADOWS.medium,
  },
  appName: {
    ...TYPOGRAPHY.h1,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  formContainer: {
    backgroundColor: '#fff',
    padding: SPACING.l,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.medium,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.m,
    marginBottom: SPACING.m,
    paddingHorizontal: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputIcon: {
    marginRight: SPACING.s,
  },
  input: {
    flex: 1,
    paddingVertical: SPACING.m,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.s,
    marginTop: SPACING.s,
    ...SHADOWS.small,
  },
  buttonDisabled: {
    opacity: 0.7,
    backgroundColor: COLORS.muted,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
  note: {
    marginTop: SPACING.l,
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
  },
});
