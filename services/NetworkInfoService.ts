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
    // Usar cache si está disponible y es reciente
    const now = Date.now();
    if (
      this.cachedNetworkInfo &&
      now - this.lastCacheTime < this.CACHE_DURATION_MS
    ) {
      return this.cachedNetworkInfo;
    }
 
     if (!netInfoAvailable || !NetInfo) {
       const networkInfo = this.getDefaultNetworkInfo();
       this.cachedNetworkInfo = networkInfo;
       this.lastCacheTime = now;
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

      // Actualizar cache
      this.cachedNetworkInfo = networkInfo;
      this.lastCacheTime = now;

      return networkInfo;
    } catch (error) {
      console.error('[NetworkInfoService] Error obteniendo info de red:', error);
      const networkInfo = this.getDefaultNetworkInfo();
      this.cachedNetworkInfo = networkInfo;
      this.lastCacheTime = now;
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
    }

    // Para cellular, estimar basado en la generación
    if (state.type === 'cellular' && state.details) {
      const details = state.details as any;
      
      if (details.cellularGeneration === '5g') return 90;
      if (details.cellularGeneration === '4g') return 75;
      if (details.cellularGeneration === '3g') return 50;
      if (details.cellularGeneration === '2g') return 25;
    }

    // Si está conectado pero no tenemos info específica, asumir señal media
    return state.isConnected ? 60 : null;
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
      if (typeof details.downlink === 'number') {
        return details.downlink;
      }
    }

    // Estimaciones basadas en tipo de conexión
    if (state.type === 'wifi') {
      return 50; // WiFi típico: 50 Mbps
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
      return 100; // Ethernet típico: 100 Mbps
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
      if (typeof details.uplink === 'number') {
        return details.uplink;
      }
    }

    // Estimaciones basadas en tipo de conexión (típicamente menor que descarga)
    const downloadSpeed = this.estimateDownloadSpeed(state);
    if (downloadSpeed !== null) {
      // Upload típicamente es 20-50% del download
      return downloadSpeed * 0.3;
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
    if (state.type === 'wifi') {
      return 20; // WiFi típico: 20ms
    }

    if (state.type === 'cellular' && state.details) {
      const details = state.details as any;
      
      // Estimaciones por generación celular
      if (details.cellularGeneration === '5g') return 10;
      if (details.cellularGeneration === '4g') return 50;
      if (details.cellularGeneration === '3g') return 100;
      if (details.cellularGeneration === '2g') return 300;
    }

    if (state.type === 'ethernet') {
      return 10; // Ethernet típico: 10ms
    }

    return 50; // Default: 50ms
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
