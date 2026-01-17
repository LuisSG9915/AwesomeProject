/**
 * DeviceInfoService
 * Servicio para obtener información del dispositivo móvil
 * Incluye: IP, nombre del dispositivo, sistema operativo, versión de la app
 */

import { Platform, NativeModules } from 'react-native';

let NetInfo: any = null;
let netInfoAvailable = false;

try {
  NetInfo = require('@react-native-community/netinfo').default;
  netInfoAvailable = true;
} catch (error) {
  console.warn('[DeviceInfoService] NetInfo no disponible, usando fallback');
  netInfoAvailable = false;
}

interface DeviceInfo {
  ipDispositivo: string | null;
  nombreDispositivo: string;
  sistemaOperativo: string;
  versionApp: string;
  marca: string;
  modelo: string;
}

class DeviceInfoService {
  private cachedDeviceInfo: DeviceInfo | null = null;
  private cachedIp: string | null = null;
  private lastIpCheck: number = 0;
  private ipCacheDurationMs: number = 60000; // 1 minuto de cache para IP

  /**
   * Obtiene la IP del dispositivo
   * Intenta obtener la IP local de la red WiFi o datos móviles
   */
  async getDeviceIp(): Promise<string | null> {
    const now = Date.now();

    // Usar cache si está disponible y es reciente
    if (this.cachedIp && now - this.lastIpCheck < this.ipCacheDurationMs) {
      return this.cachedIp;
    }

    // Si NetInfo no está disponible, retornar fallback
    if (!netInfoAvailable || !NetInfo) {
      this.cachedIp = 'netinfo-unavailable';
      this.lastIpCheck = now;
      return this.cachedIp;
    }

    try {
      const netInfo = await NetInfo.fetch();

      // Intentar obtener la IP según el tipo de conexión
      if (netInfo.isConnected) {
        // En Android, podemos obtener la IP de la conexión actual
        if (Platform.OS === 'android' && netInfo.details) {
          const details = netInfo.details as any;
          if (details.ipAddress) {
            this.cachedIp = details.ipAddress;
            this.lastIpCheck = now;
            return this.cachedIp;
          }
        }

        // En iOS, el acceso a la IP local es más limitado
        // Usamos la información de tipo de conexión como fallback
        if (Platform.OS === 'ios' && netInfo.details) {
          const details = netInfo.details as any;
          if (details.ipAddress) {
            this.cachedIp = details.ipAddress;
            this.lastIpCheck = now;
            return this.cachedIp;
          }
        }

        // Fallback: intentar obtener IP pública (requiere conexión a internet)
        try {
          const response = await fetch('https://api.ipify.org?format=json', {
            method: 'GET',
            headers: { Accept: 'application/json' },
          });

          if (response.ok) {
            const data = await response.json();
            this.cachedIp = data.ip;
            this.lastIpCheck = now;
            return this.cachedIp;
          }
        } catch (publicIpError) {
          console.warn(
            '[DeviceInfoService] No se pudo obtener IP pública:',
            publicIpError,
          );
        }
      }

      // Si todo falla, retornar información de conexión
      this.cachedIp =
        netInfo.type !== 'none' ? `${netInfo.type}-connected` : 'sin-conexion';
      this.lastIpCheck = now;
      return this.cachedIp;
    } catch (error) {
      console.error('[DeviceInfoService] Error obteniendo IP:', error);
      this.cachedIp = 'error-ip';
      this.lastIpCheck = now;
      return this.cachedIp;
    }
  }

  /**
   * Obtiene información básica del dispositivo
   */
  getBasicDeviceInfo(): Omit<DeviceInfo, 'ipDispositivo'> {
    const os = Platform.OS;
    const version = Platform.Version;

    return {
      nombreDispositivo: this.getDeviceName(),
      sistemaOperativo: `${os} ${version}`,
      versionApp: this.getAppVersion(),
      marca: this.getDeviceBrand(),
      modelo: this.getDeviceModel(),
    };
  }

  /**
   * Obtiene toda la información del dispositivo incluyendo IP
   */
  async getFullDeviceInfo(): Promise<DeviceInfo> {
    const basicInfo = this.getBasicDeviceInfo();
    const ip = await this.getDeviceIp();

    return {
      ...basicInfo,
      ipDispositivo: ip,
    };
  }

  /**
   * Obtiene el nombre del dispositivo
   */
  private getDeviceName(): string {
    try {
      // En React Native, podemos usar react-native-device-info si está disponible
      // Por ahora usamos valores basados en la plataforma
      if (Platform.OS === 'android') {
        return Platform.constants?.Model || 'Android Device';
      } else if (Platform.OS === 'ios') {
        return 'iOS Device';
      }
      return 'Unknown Device';
    } catch (error) {
      return 'Unknown Device';
    }
  }

  /**
   * Obtiene la marca del dispositivo
   */
  private getDeviceBrand(): string {
    try {
      if (Platform.OS === 'android') {
        return (
          Platform.constants?.Manufacturer ||
          Platform.constants?.Brand ||
          'Android'
        );
      } else if (Platform.OS === 'ios') {
        return 'Apple';
      }
      return 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Obtiene el modelo del dispositivo
   */
  private getDeviceModel(): string {
    try {
      if (Platform.OS === 'android') {
        return Platform.constants?.Model || 'Unknown';
      } else if (Platform.OS === 'ios') {
        return 'iPhone/iPad';
      }
      return 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Obtiene la versión de la aplicación
   * TODO: Obtener versión real desde package.json o BuildConfig
   */
  private getAppVersion(): string {
    try {
      // Idealmente usar react-native-device-info para obtener la versión real
      // Por ahora retornamos un valor placeholder
      return '1.1.1';
    } catch (error) {
      return '1.1.1';
    }
  }

  /**
   * Obtiene información de red actual
   */
  async getNetworkInfo(): Promise<{
    isConnected: boolean;
    type: string;
    isWifi: boolean;
    isInternetReachable: boolean | null;
  }> {
    // Si NetInfo no está disponible, retornar valores por defecto
    if (!netInfoAvailable || !NetInfo) {
      console.warn(
        '[DeviceInfoService] NetInfo no disponible, usando valores por defecto',
      );
      return {
        isConnected: true, // Asumir conectado para no bloquear la app
        type: 'unknown',
        isWifi: false,
        isInternetReachable: null,
      };
    }

    try {
      const netInfo = await NetInfo.fetch();
      return {
        isConnected: netInfo.isConnected ?? false,
        type: netInfo.type,
        isWifi: netInfo.type === 'wifi',
        isInternetReachable: netInfo.isInternetReachable,
      };
    } catch (error) {
      console.error('[DeviceInfoService] Error obteniendo info de red:', error);
      return {
        isConnected: true, // Asumir conectado en caso de error
        type: 'unknown',
        isWifi: false,
        isInternetReachable: null,
      };
    }
  }

  /**
   * Invalida el cache de IP para forzar una nueva obtención
   */
  invalidateIpCache(): void {
    this.cachedIp = null;
    this.lastIpCheck = 0;
  }
}

// Exportar instancia singleton
export const deviceInfoService = new DeviceInfoService();
export default deviceInfoService;
export type { DeviceInfo };
