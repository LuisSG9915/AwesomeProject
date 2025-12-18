/**
 * NetworkInfoService
 * Servicio para capturar información detallada de conectividad de red
 *
 * Funcionalidades:
 * - Detectar tipo de conexión (WiFi, Cellular, etc.)
 * - Medir calidad de señal
 * - Estimar velocidades de conexión
 * - Detectar si es conexión con límite de datos
 */

import type { NetInfoState } from '@react-native-community/netinfo';

let NetInfo: any = null;
let netInfoAvailable = false;

try {
  NetInfo = require('@react-native-community/netinfo').default;
  netInfoAvailable = true;
} catch (error) {
  console.warn('[NetworkInfoService] NetInfo no disponible, usando fallback');
  netInfoAvailable = false;
}

export interface NetworkInfo {
  tipoConexion: string | null; // 'wifi', 'cellular', 'ethernet', 'bluetooth', 'wimax', 'vpn', 'none', 'unknown'
  tipoConexionDetallado: string | null; // '2g', '3g', '4g', '5g', 'wifi', etc.
  estadoConexion: boolean | null; // true = conectado, false = desconectado
  intensidadSenal: number | null; // 0-100 (porcentaje de calidad de señal)
  velocidadDescargaMbps: number | null; // Velocidad estimada de descarga en Mbps
  velocidadCargaMbps: number | null; // Velocidad estimada de carga en Mbps
  latenciaMs: number | null; // Latencia en milisegundos (estimada)
  esConexionMetered: boolean | null; // true si es conexión con límite de datos
}

class NetworkInfoService {
  private cachedNetworkInfo: NetworkInfo | null = null;
  private lastCacheTime: number = 0;
  private CACHE_DURATION_MS = 5000; // Cache de 5 segundos

  /**
   * Obtiene información completa de la red actual
   */
  async getNetworkInfo(): Promise<NetworkInfo> {
    if (!netInfoAvailable || !NetInfo) {
      const networkInfo = this.getDefaultNetworkInfo();
      return networkInfo;
    }

    try {
      const state: NetInfoState = await NetInfo.fetch();

      const networkInfo: NetworkInfo = {
        tipoConexion: this.mapConnectionType(state.type),
        tipoConexionDetallado: this.getDetailedConnectionType(state),
        estadoConexion: state.isConnected ?? null,
        intensidadSenal: this.calculateSignalStrength(state),
        velocidadDescargaMbps: this.estimateDownloadSpeed(state),
        velocidadCargaMbps: this.estimateUploadSpeed(state),
        latenciaMs: this.estimateLatency(state),
        esConexionMetered: this.isMeteredConnection(state),
      };

      console.log('[NetworkInfoService] Info de red capturada:', {
        tipo: networkInfo.tipoConexion,
        detallado: networkInfo.tipoConexionDetallado,
        conectado: networkInfo.estadoConexion,
        señal: networkInfo.intensidadSenal,
        download: networkInfo.velocidadDescargaMbps,
        upload: networkInfo.velocidadCargaMbps,
        latencia: networkInfo.latenciaMs,
        metered: networkInfo.esConexionMetered,
      });

      return networkInfo;
    } catch (error) {
      console.error(
        '[NetworkInfoService] Error obteniendo info de red:',
        error,
      );
      const networkInfo = this.getDefaultNetworkInfo();
      return networkInfo;
    }
  }

  /**
   * Invalida el cache de información de red
   */
  invalidateCache(): void {
    this.cachedNetworkInfo = null;
    this.lastCacheTime = 0;
  }

  /**
   * Mapea el tipo de conexión a formato estándar
   */
  private mapConnectionType(type: string | null): string | null {
    if (!type) return 'unknown';

    const typeMap: { [key: string]: string } = {
      wifi: 'wifi',
      cellular: 'cellular',
      ethernet: 'ethernet',
      bluetooth: 'bluetooth',
      wimax: 'wimax',
      vpn: 'vpn',
      none: 'none',
      unknown: 'unknown',
    };

    return typeMap[type.toLowerCase()] || 'unknown';
  }

  /**
   * Obtiene el tipo de conexión detallado (generación de red celular)
   */
  private getDetailedConnectionType(state: NetInfoState): string | null {
    if (state.type === 'wifi') {
      return 'wifi';
    }

    if (state.type === 'cellular' && state.details) {
      const details = state.details as any;

      // React Native NetInfo proporciona cellularGeneration
      if (details.cellularGeneration) {
        return details.cellularGeneration; // '2g', '3g', '4g', '5g'
      }
    }

    return state.type || 'unknown';
  }

  /**
   * Calcula la intensidad de señal (0-100)
   * Basado en la información disponible de la conexión
   */
  private calculateSignalStrength(state: NetInfoState): number | null {
    if (!state.isConnected) {
      return 0;
    }

    // Para WiFi, intentar obtener la fuerza de señal si está disponible
    if (state.type === 'wifi' && state.details) {
      const details = state.details as any;

      console.log(
        '[NetworkInfoService] WiFi details:',
        JSON.stringify(details),
      );

      // Algunos dispositivos proporcionan strength (0-100)
      if (typeof details.strength === 'number') {
        return Math.max(0, Math.min(100, details.strength));
      }

      // Algunos proporcionan rssi (dBm, típicamente -100 a -30)
      if (typeof details.rssi === 'number') {
        // Convertir RSSI a porcentaje (aproximado)
        // -30 dBm = 100%, -90 dBm = 0%
        const rssi = details.rssi;
        const percentage = Math.round(((rssi + 90) / 60) * 100);
        return Math.max(0, Math.min(100, percentage));
      }

      // Algunos proporcionan linkSpeed (Mbps)
      if (typeof details.linkSpeed === 'number') {
        // Estimar señal basado en linkSpeed
        // > 100 Mbps = 95%, 50-100 = 80%, 25-50 = 60%, < 25 = 40%
        if (details.linkSpeed > 100) return 95;
        if (details.linkSpeed > 50) return 80;
        if (details.linkSpeed > 25) return 60;
        return 40;
      }
    }

    // Para cellular, estimar basado en la generación
    if (state.type === 'cellular' && state.details) {
      const details = state.details as any;

      console.log(
        '[NetworkInfoService] Cellular details:',
        JSON.stringify(details),
      );

      if (details.cellularGeneration === '5g') return 90;
      if (details.cellularGeneration === '4g') return 75;
      if (details.cellularGeneration === '3g') return 50;
      if (details.cellularGeneration === '2g') return 25;
    }

    // Si está conectado pero no tenemos info específica, retornar null
    return null;
  }

  /**
   * Estima la velocidad de descarga en Mbps
   */
  private estimateDownloadSpeed(state: NetInfoState): number | null {
    if (!state.isConnected) {
      return 0;
    }

    // Si NetInfo proporciona velocidad efectiva
    if (state.details) {
      const details = state.details as any;

      // Algunos dispositivos proporcionan downlink (Mbps)
      if (typeof details.downlink === 'number' && details.downlink > 0) {
        return details.downlink;
      }

      // Para WiFi, usar linkSpeed si está disponible
      if (
        state.type === 'wifi' &&
        typeof details.linkSpeed === 'number' &&
        details.linkSpeed > 0
      ) {
        return details.linkSpeed;
      }

      // effectiveType proporciona estimación (slow-2g, 2g, 3g, 4g)
      if (details.effectiveType) {
        const effectiveType = details.effectiveType.toLowerCase();
        if (effectiveType.includes('4g')) return 20;
        if (effectiveType.includes('3g')) return 2;
        if (effectiveType.includes('2g')) return 0.3;
      }
    }

    // Estimaciones basadas en tipo de conexión (solo como último recurso)
    if (state.type === 'wifi') {
      return null; // No estimamos, esperamos datos reales
    }

    if (state.type === 'cellular' && state.details) {
      const details = state.details as any;

      // Estimaciones por generación celular
      if (details.cellularGeneration === '5g') return 100;
      if (details.cellularGeneration === '4g') return 20;
      if (details.cellularGeneration === '3g') return 2;
      if (details.cellularGeneration === '2g') return 0.1;
    }

    if (state.type === 'ethernet') {
      return null; // No estimamos
    }

    return null;
  }

  /**
   * Estima la velocidad de carga en Mbps
   */
  private estimateUploadSpeed(state: NetInfoState): number | null {
    if (!state.isConnected) {
      return 0;
    }

    // Si NetInfo proporciona velocidad efectiva
    if (state.details) {
      const details = state.details as any;

      // Algunos dispositivos proporcionan uplink (Mbps)
      if (typeof details.uplink === 'number' && details.uplink > 0) {
        return details.uplink;
      }
    }

    // Estimaciones basadas en descarga
    const downloadSpeed = this.estimateDownloadSpeed(state);
    if (downloadSpeed !== null) {
      if (state.type === 'cellular') {
        // Upload típicamente es 20-40% del download para cellular
        return Math.round(downloadSpeed * 0.3 * 10) / 10;
      }

      if (state.type === 'wifi') {
        // Upload típicamente es 70-90% del download para WiFi
        return Math.round(downloadSpeed * 0.8 * 10) / 10;
      }

      if (state.type === 'ethernet') {
        // Ethernet típicamente tiene upload similar al download
        return Math.round(downloadSpeed * 0.9 * 10) / 10;
      }
    }

    return null;
  }

  /**
   * Estima la latencia en milisegundos
   */
  private estimateLatency(state: NetInfoState): number | null {
    if (!state.isConnected) {
      return null;
    }

    // Estimaciones basadas en tipo de conexión
    if (state.type === 'cellular' && state.details) {
      const details = state.details as any;

      // Estimaciones por generación celular
      if (details.cellularGeneration === '5g') return 10;
      if (details.cellularGeneration === '4g') return 50;
      if (details.cellularGeneration === '3g') return 100;
      if (details.cellularGeneration === '2g') return 300;
    }

    // Para WiFi, estimar basado en velocidad de descarga
    if (state.type === 'wifi') {
      const downloadSpeed = this.estimateDownloadSpeed(state);
      if (downloadSpeed !== null) {
        // Velocidades altas = latencia baja
        if (downloadSpeed > 50) return 5; // Excelente
        if (downloadSpeed > 25) return 10; // Buena
        if (downloadSpeed > 10) return 20; // Regular
        return 30; // Baja
      }
      // Si no tenemos velocidad, asumir latencia típica de WiFi
      return 10;
    }

    // Para Ethernet, latencia típicamente muy baja
    if (state.type === 'ethernet') {
      return 2;
    }

    return null;
  }

  /**
   * Determina si la conexión tiene límite de datos (metered)
   */
  private isMeteredConnection(state: NetInfoState): boolean | null {
    if (!state.isConnected) {
      return null;
    }

    // Cellular siempre es metered
    if (state.type === 'cellular') {
      return true;
    }

    // WiFi y Ethernet típicamente no son metered
    if (state.type === 'wifi' || state.type === 'ethernet') {
      return false;
    }

    // Otros tipos: desconocido
    return null;
  }

  /**
   * Retorna información de red por defecto en caso de error
   */
  private getDefaultNetworkInfo(): NetworkInfo {
    return {
      tipoConexion: 'unknown',
      tipoConexionDetallado: 'unknown',
      estadoConexion: null,
      intensidadSenal: null,
      velocidadDescargaMbps: null,
      velocidadCargaMbps: null,
      latenciaMs: null,
      esConexionMetered: null,
    };
  }

  /**
   * Obtiene un resumen legible de la conexión
   */
  async getNetworkSummary(): Promise<string> {
    const info = await this.getNetworkInfo();

    if (!info.estadoConexion) {
      return 'Sin conexión';
    }

    const parts: string[] = [];

    if (info.tipoConexionDetallado) {
      parts.push(info.tipoConexionDetallado.toUpperCase());
    }

    if (info.intensidadSenal !== null) {
      parts.push(`Señal: ${info.intensidadSenal}%`);
    }

    if (info.velocidadDescargaMbps !== null) {
      parts.push(`↓${info.velocidadDescargaMbps.toFixed(1)}Mbps`);
    }

    return parts.join(' | ') || 'Conectado';
  }
}

export const networkInfoService = new NetworkInfoService();
