import AsyncStorage from '@react-native-async-storage/async-storage';
import FullSyncService from './FullSyncService';

const API_BASE_URL = 'https://cbinfo.no-ip.info:9011';

const SESSION_STORAGE_KEY = '@awesomeapp/current_user';

export type Usuario = {
  claveEmpleado: string;
  password?: string;
  sucursal?: number | null;
  sucursal_origen?: number | null;
  idDepartamento?: number | null;
  [key: string]: any;
};

class AuthService {
  private _currentUser: Usuario | null = null;

  get currentUser() {
    return this._currentUser;
  }

  async login(usuario: string, password: string): Promise<Usuario> {
    console.log('Logging in user:', usuario);
    const url = `${API_BASE_URL}/api/Login/${encodeURIComponent(
      usuario,
    )}/${encodeURIComponent(password)}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Error de conexión (${res.status})`);
    }
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Usuario o contraseña incorrectos');
    }

    const user: Usuario = data[0];

    if (!user.sucursal_origen && user.sucursal) {
      user.sucursal_origen = user.sucursal;
    }

    this._currentUser = user;

    try {
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } catch (storageError) {
      console.error(
        'No fue posible guardar la sesión localmente:',
        storageError,
      );
    }

    // Configurar contexto de usuario para bitácoras
    this.configurarContextoBitacora(user);

    return user;
  }

  /**
   * Configura el contexto de usuario para el sistema de bitácoras
   */
  private configurarContextoBitacora(user: Usuario): void {
    try {
      const userId = user.idEmpleado || user.id || 0;
      const userName = user.nombre || user.claveEmpleado || 'Desconocido';
      const sucursal = user.sucursal || user.sucursal_origen || 1;

      FullSyncService.setUserContext(userId, userName, sucursal);
      console.log('[AuthService] ✅ Contexto de bitácora configurado:', {
        userId,
        userName,
        sucursal,
      });
    } catch (error) {
      console.error(
        '[AuthService] ⚠️ Error configurando contexto de bitácora:',
        error,
      );
    }
  }

  async restoreSession(): Promise<Usuario | null> {
    if (this._currentUser) {
      return this._currentUser;
    }

    console.log('Attempting to restore session from storage');
    try {
      const stored = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const parsed: Usuario = JSON.parse(stored);
      console.log('Session restored:', parsed);
      this._currentUser = parsed;

      // Configurar contexto de usuario para bitácoras al restaurar sesión
      this.configurarContextoBitacora(parsed);

      return parsed;
    } catch (error) {
      console.error('No fue posible restaurar la sesión:', error);
      return null;
    }
  }

  async logout() {
    this._currentUser = null;

    try {
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.error('No fue posible limpiar la sesión local:', error);
    }
  }
}

export default new AuthService();
