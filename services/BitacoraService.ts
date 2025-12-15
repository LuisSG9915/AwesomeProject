/**
 * BitacoraService
 * Servicio para gestión completa de bitácoras de sincronización
 *
 * Funcionalidades:
 * - Registro local de todas las sincronizaciones
 * - Captura de información del dispositivo y usuario
 * - Arrastre periódico de bitácoras al servidor (últimos 3 días)
 * - Descripción detallada de errores
 */

import Realm, { UpdateMode } from 'realm';
import { deviceInfoService, DeviceInfo } from './DeviceInfoService';
import { networkInfoService, NetworkInfo } from './NetworkInfoService';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export interface BitacoraEntry {
  id: string;
  idBitacoraMovil: string;
  fechaInicio: Date;
  fechaFinal: Date | null;
  duracionMs: number | null;

  // Usuario
  idUsuario: number | null;
  nombreUsuario: string | null;

  // Dispositivo
  ipDispositivo: string | null;
  nombreDispositivo: string | null;
  sistemaOperativo: string | null;
  versionApp: string | null;

  // Conectividad de red
  tipoConexion: string | null;
  tipoConexionDetallado: string | null;
  estadoConexion: boolean | null;
  intensidadSenal: number | null;
  velocidadDescargaMbps: number | null;
  velocidadCargaMbps: number | null;
  latenciaMs: number | null;
  esConexionMetered: boolean | null;

  // Sincronización
  sucursal: number;
  tabla: string;
  tipoSync: 'completa' | 'incremental' | 'manual';
  endpoint: string | null;

  // Estadísticas
  registrosLeidos: number;
  registrosGuardados: number;
  registrosActualizados: number;
  registrosEliminados: number;

  // Estado
  exitoso: boolean;
  codigoError: string | null;
  descripcionError: string | null;
  stackTrace: string | null;

  // Metadata
  detallesJSON: string | null;
  enviado: boolean;
  fechaEnvio: Date | null;
}

export interface BitacoraSesion {
  id: string;
  idSesionMovil: string;
  fechaInicio: Date;
  fechaFinal: Date | null;
  duracionTotalMs: number | null;

  idUsuario: number | null;
  nombreUsuario: string | null;
  ipDispositivo: string | null;
  nombreDispositivo: string | null;

  sucursal: number;
  tipoSync: 'completa' | 'incremental' | 'manual';

  totalTablas: number;
  tablasExitosas: number;
  tablasConError: number;
  totalRegistros: number;

  exitoso: boolean;
  resumenErrores: string | null;

  enviado: boolean;
  fechaEnvio: Date | null;
}

// ============================================================================
// SCHEMAS DE REALM PARA BITÁCORA
// ============================================================================

export const BitacoraSyncSchema = {
  name: 'BitacoraSync',
  properties: {
    id: 'string',
    idBitacoraMovil: 'string',
    fechaInicio: 'date',
    fechaFinal: 'date?',
    duracionMs: 'int?',

    // Usuario
    idUsuario: 'int?',
    nombreUsuario: 'string?',

    // Dispositivo
    ipDispositivo: 'string?',
    nombreDispositivo: 'string?',
    sistemaOperativo: 'string?',
    versionApp: 'string?',

    // Conectividad de red
    tipoConexion: 'string?',
    tipoConexionDetallado: 'string?',
    estadoConexion: 'bool?',
    intensidadSenal: 'int?',
    velocidadDescargaMbps: 'double?',
    velocidadCargaMbps: 'double?',
    latenciaMs: 'int?',
    esConexionMetered: 'bool?',

    // Sincronización
    sucursal: 'int',
    tabla: 'string',
    tipoSync: 'string',
    endpoint: 'string?',

    // Estadísticas
    registrosLeidos: 'int',
    registrosGuardados: 'int',
    registrosActualizados: 'int',
    registrosEliminados: 'int',

    // Estado
    exitoso: 'bool',
    codigoError: 'string?',
    descripcionError: 'string?',
    stackTrace: 'string?',

    // Metadata
    detallesJSON: 'string?',
    enviado: 'bool',
    fechaEnvio: 'date?',
  },
  primaryKey: 'id',
};

export const BitacoraSesionSchema = {
  name: 'BitacoraSesion',
  properties: {
    id: 'string',
    idSesionMovil: 'string',
    fechaInicio: 'date',
    fechaFinal: 'date?',
    duracionTotalMs: 'int?',

    idUsuario: 'int?',
    nombreUsuario: 'string?',
    ipDispositivo: 'string?',
    nombreDispositivo: 'string?',

    sucursal: 'int',
    tipoSync: 'string',

    totalTablas: 'int',
    tablasExitosas: 'int',
    tablasConError: 'int',
    totalRegistros: 'int',

    exitoso: 'bool',
    resumenErrores: 'string?',

    enviado: 'bool',
    fechaEnvio: 'date?',
  },
  primaryKey: 'id',
};

// ============================================================================
// CLASE PRINCIPAL DEL SERVICIO
// ============================================================================

class BitacoraService {
  private realm: Realm | null = null;
  private apiBaseUrl = 'https://cbinfo.no-ip.info:9011';

  // Contexto de usuario actual
  private currentUserId: number | null = null;
  private currentUserName: string | null = null;
  private currentSucursal: number = 1;
  private cachedDeviceInfo: DeviceInfo | null = null;
  private cachedNetworkInfo: NetworkInfo | null = null;
  private currentAppSessionId: string | null = null;
  private lastAppState: string | null = null;
  private lastScreen: string | null = null;
  private currentAppSessionStart: Date | null = null;
  private pendingAppEvents: any[] = [];

  /**
   * Inicializa el servicio con el realm proporcionado
   */
  setRealm(realm: Realm): void {
    this.realm = realm;

    void this.flushPendingAppLogs();
  }

  /**
   * Configura el contexto de usuario
   */
  setUserContext(userId: number, userName: string, sucursal: number): void {
    this.currentUserId = userId;
    this.currentUserName = userName;
    this.currentSucursal = sucursal;
    console.log(
      `[BitacoraService] Contexto configurado: Usuario=${userName} (${userId}), Sucursal=${sucursal}`,
    );

    try {
      if (this.realm && this.currentAppSessionId) {
        this.realm.write(() => {
          const sesion: any = this.realm!.objectForPrimaryKey(
            'BitacoraAppSesion',
            this.currentAppSessionId!,
          );
          if (sesion) {
            sesion.idUsuario = this.currentUserId;
            sesion.nombreUsuario = this.currentUserName;
            sesion.sucursal = this.currentSucursal;
          }
        });
      }
    } catch (error) {
      console.warn(
        '[BitacoraService] No se pudo actualizar contexto en sesión de app',
        error,
      );
    }
  }

  /**
   * Genera un ID único para bitácora
   */
  private generateBitacoraId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Obtiene información del dispositivo (con cache)
   */
  private async getDeviceInfo(): Promise<DeviceInfo> {
    if (this.cachedDeviceInfo) {
      return this.cachedDeviceInfo;
    }

    try {
      this.cachedDeviceInfo = await deviceInfoService.getFullDeviceInfo();
    } catch (error) {
      console.error(
        '[BitacoraService] Error obteniendo info de dispositivo, usando fallback:',
        error,
      );
      this.cachedDeviceInfo = {
        ipDispositivo: null,
        nombreDispositivo: 'Unknown Device',
        sistemaOperativo: 'unknown',
        versionApp: 'unknown',
        marca: 'Unknown',
        modelo: 'Unknown',
      };
    }

    return this.cachedDeviceInfo;
  }

  /**
   * Obtiene información de red (con cache)
   */
  private async getNetworkInfo(): Promise<NetworkInfo> {
    if (this.cachedNetworkInfo) {
      return this.cachedNetworkInfo;
    }

    try {
      this.cachedNetworkInfo = await networkInfoService.getNetworkInfo();
    } catch (error) {
      console.error(
        '[BitacoraService] Error obteniendo info de red, usando fallback:',
        error,
      );
      this.cachedNetworkInfo = {
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

    return this.cachedNetworkInfo;
  }

  /**
   * Invalida el cache de información del dispositivo y red
   */
  invalidateDeviceInfoCache(): void {
    this.cachedDeviceInfo = null;
    this.cachedNetworkInfo = null;
    deviceInfoService.invalidateIpCache();
    try {
      networkInfoService.invalidateCache();
    } catch (error) {
      console.warn('[BitacoraService] No se pudo invalidar cache de red');
    }
  }

  /**
   * Genera descripción detallada del error
   */
  private generateErrorDescription(
    error: Error | any,
    context: string,
  ): string {
    const errorType = error?.name || 'Error';
    const errorMessage = error?.message || 'Error desconocido';
    const errorCode = error?.code || 'UNKNOWN';

    let description = `[${context}] ${errorType}: ${errorMessage}`;

    // Agregar información adicional según el tipo de error
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      description +=
        '\n→ Causa probable: Problema de conexión a internet o servidor no disponible.';
      description +=
        '\n→ Acción sugerida: Verificar conexión WiFi/datos móviles y reintentar.';
    } else if (errorMessage.includes('timeout')) {
      description +=
        '\n→ Causa probable: El servidor tardó demasiado en responder.';
      description +=
        '\n→ Acción sugerida: Reintentar en unos minutos o verificar estado del servidor.';
    } else if (errorMessage.includes('HTTP 4')) {
      description +=
        '\n→ Causa probable: Error en la solicitud (datos incorrectos o recurso no encontrado).';
      description +=
        '\n→ Acción sugerida: Verificar parámetros de sincronización.';
    } else if (errorMessage.includes('HTTP 5')) {
      description += '\n→ Causa probable: Error interno del servidor.';
      description +=
        '\n→ Acción sugerida: Contactar al administrador del sistema.';
    } else if (
      errorMessage.includes('Realm') ||
      errorMessage.includes('database')
    ) {
      description +=
        '\n→ Causa probable: Error al escribir en la base de datos local.';
      description +=
        '\n→ Acción sugerida: Verificar espacio en disco o reiniciar la aplicación.';
    } else if (
      errorMessage.includes('JSON') ||
      errorMessage.includes('parse')
    ) {
      description +=
        '\n→ Causa probable: Respuesta del servidor en formato incorrecto.';
      description +=
        '\n→ Acción sugerida: Verificar versión de la API con el administrador.';
    }

    return description;
  }

  /**
   * Registra el inicio de una sincronización de tabla
   */
  async registrarInicioSync(
    tabla: string,
    tipoSync: 'completa' | 'incremental' | 'manual',
    endpoint: string,
    sesionId?: string,
  ): Promise<string> {
    if (!this.realm) {
      console.warn('[BitacoraService] Realm no inicializado');
      return this.generateBitacoraId();
    }

    const deviceInfo = await this.getDeviceInfo();
    const networkInfo = await this.getNetworkInfo();
    const id = this.generateBitacoraId();
    const idBitacoraMovil = `${id}-${tabla}`;

    try {
      this.realm.write(() => {
        this.realm!.create('BitacoraSync', {
          id,
          idBitacoraMovil,
          fechaInicio: new Date(),
          fechaFinal: null,
          duracionMs: null,

          idUsuario: this.currentUserId,
          nombreUsuario: this.currentUserName,

          ipDispositivo: deviceInfo.ipDispositivo,
          nombreDispositivo: deviceInfo.nombreDispositivo,
          sistemaOperativo: deviceInfo.sistemaOperativo,
          versionApp: deviceInfo.versionApp,

          tipoConexion: networkInfo.tipoConexion,
          tipoConexionDetallado: networkInfo.tipoConexionDetallado,
          estadoConexion: networkInfo.estadoConexion,
          intensidadSenal: networkInfo.intensidadSenal,
          velocidadDescargaMbps: networkInfo.velocidadDescargaMbps,
          velocidadCargaMbps: networkInfo.velocidadCargaMbps,
          latenciaMs: networkInfo.latenciaMs,
          esConexionMetered: networkInfo.esConexionMetered,

          sucursal: this.currentSucursal,
          tabla,
          tipoSync,
          endpoint,

          registrosLeidos: 0,
          registrosGuardados: 0,
          registrosActualizados: 0,
          registrosEliminados: 0,

          exitoso: true,
          codigoError: null,
          descripcionError: null,
          stackTrace: null,

          detallesJSON: sesionId ? JSON.stringify({ sesionId }) : null,
          enviado: false,
          fechaEnvio: null,
        });
      });

      console.log(`[BitacoraService] Inicio registrado: ${tabla} (${id})`);
    } catch (error) {
      console.error('[BitacoraService] Error registrando inicio:', error);
    }

    return id;
  }

  /**
   * Registra la finalización de una sincronización de tabla
   */
  async registrarFinSync(
    id: string,
    resultado: {
      exitoso: boolean;
      registrosLeidos?: number;
      registrosGuardados?: number;
      registrosActualizados?: number;
      registrosEliminados?: number;
      error?: Error | any;
      detalles?: any;
    },
  ): Promise<void> {
    if (!this.realm) {
      console.warn('[BitacoraService] Realm no inicializado');
      return;
    }

    const fechaFinal = new Date();

    try {
      this.realm.write(() => {
        const bitacora: any = this.realm!.objectForPrimaryKey(
          'BitacoraSync',
          id,
        );

        if (bitacora) {
          bitacora.fechaFinal = fechaFinal;
          bitacora.duracionMs =
            fechaFinal.getTime() - bitacora.fechaInicio.getTime();

          bitacora.registrosLeidos = resultado.registrosLeidos || 0;
          bitacora.registrosGuardados = resultado.registrosGuardados || 0;
          bitacora.registrosActualizados = resultado.registrosActualizados || 0;
          bitacora.registrosEliminados = resultado.registrosEliminados || 0;

          bitacora.exitoso = resultado.exitoso;

          if (!resultado.exitoso && resultado.error) {
            const error = resultado.error;
            bitacora.codigoError = error.code || error.name || 'ERROR';
            bitacora.descripcionError = this.generateErrorDescription(
              error,
              bitacora.tabla,
            );
            bitacora.stackTrace = error.stack || null;
          }

          if (resultado.detalles) {
            // Actualizar endpoint si viene en los detalles
            if (resultado.detalles.endpoint) {
              bitacora.endpoint = resultado.detalles.endpoint;
            }

            const existingDetalles = bitacora.detallesJSON
              ? JSON.parse(bitacora.detallesJSON)
              : {};
            bitacora.detallesJSON = JSON.stringify({
              ...existingDetalles,
              ...resultado.detalles,
            });
          }
        }
      });

      console.log(
        `[BitacoraService] Fin registrado: ${id}, Exitoso: ${resultado.exitoso}`,
      );
    } catch (error) {
      console.error('[BitacoraService] Error registrando fin:', error);
    }
  }

  /**
   * Registra el inicio de una sesión de sincronización completa
   */
  async registrarInicioSesion(
    tipoSync: 'completa' | 'incremental' | 'manual',
  ): Promise<string> {
    if (!this.realm) {
      console.warn('[BitacoraService] Realm no inicializado');
      return this.generateBitacoraId();
    }

    const deviceInfo = await this.getDeviceInfo();
    const id = this.generateBitacoraId();
    const idSesionMovil = `SES-${id}`;

    try {
      this.realm.write(() => {
        this.realm!.create('BitacoraSesion', {
          id,
          idSesionMovil,
          fechaInicio: new Date(),
          fechaFinal: null,
          duracionTotalMs: null,

          idUsuario: this.currentUserId,
          nombreUsuario: this.currentUserName,
          ipDispositivo: deviceInfo.ipDispositivo,
          nombreDispositivo: deviceInfo.nombreDispositivo,

          sucursal: this.currentSucursal,
          tipoSync,

          totalTablas: 0,
          tablasExitosas: 0,
          tablasConError: 0,
          totalRegistros: 0,

          exitoso: true,
          resumenErrores: null,

          enviado: false,
          fechaEnvio: null,
        });
      });

      console.log(`[BitacoraService] Sesión iniciada: ${tipoSync} (${id})`);
    } catch (error) {
      console.error('[BitacoraService] Error iniciando sesión:', error);
    }

    return id;
  }

  /**
   * Registra la finalización de una sesión de sincronización
   */
  async registrarFinSesion(
    id: string,
    resultado: {
      totalTablas: number;
      tablasExitosas: number;
      tablasConError: number;
      totalRegistros: number;
      errores?: string[];
    },
  ): Promise<void> {
    if (!this.realm) return;

    const fechaFinal = new Date();

    try {
      this.realm.write(() => {
        const sesion: any = this.realm!.objectForPrimaryKey(
          'BitacoraSesion',
          id,
        );

        if (sesion) {
          sesion.fechaFinal = fechaFinal;
          sesion.duracionTotalMs =
            fechaFinal.getTime() - sesion.fechaInicio.getTime();

          sesion.totalTablas = resultado.totalTablas;
          sesion.tablasExitosas = resultado.tablasExitosas;
          sesion.tablasConError = resultado.tablasConError;
          sesion.totalRegistros = resultado.totalRegistros;

          sesion.exitoso = resultado.tablasConError === 0;

          if (resultado.errores && resultado.errores.length > 0) {
            sesion.resumenErrores = resultado.errores.join('\n---\n');
          }
        }
      });

      console.log(`[BitacoraService] Sesión finalizada: ${id}`);
    } catch (error) {
      console.error('[BitacoraService] Error finalizando sesión:', error);
    }
  }

  private async persistSesionAppIfNeeded(): Promise<void> {
    if (!this.realm || this.realm.isClosed || !this.currentAppSessionId) {
      return;
    }

    const existing: any = this.realm.objectForPrimaryKey(
      'BitacoraAppSesion',
      this.currentAppSessionId,
    );

    if (existing) {
      return;
    }

    const id = this.currentAppSessionId;
    const fechaInicio = this.currentAppSessionStart || new Date();

    try {
      this.realm.write(() => {
        const sesiones: any = this.realm!.objects('BitacoraAppSesion');
        for (let i = 0; i < sesiones.length; i++) {
          const s: any = sesiones[i];
          if (!s.fechaFinal) {
            const razon =
              s.razonCierre ||
              (s.ultimoAppState === 'background'
                ? 'cierre_forzado_background'
                : s.ultimoAppState === 'active'
                  ? 'cierre_forzado_activo'
                  : 'cierre_forzado');
            s.fechaFinal = fechaInicio;
            s.duracionTotalMs = fechaInicio.getTime() - s.fechaInicio.getTime();
            s.razonCierre = razon;
          }
        }
      });
    } catch (error) {
      console.warn(
        '[BitacoraService] No se pudieron cerrar sesiones de app previas',
        error,
      );
    }

    const deviceInfo = await this.getDeviceInfo();
    const networkInfo = await this.getNetworkInfo();
    const idSesionAppMovil = `APP-SES-${id}`;

    try {
      this.realm.write(() => {
        this.realm!.create(
          'BitacoraAppSesion',
          {
            id,
            idSesionAppMovil,
            fechaInicio,
            fechaFinal: null,
            duracionTotalMs: null,

            idUsuario: this.currentUserId,
            nombreUsuario: this.currentUserName,
            sucursal: this.currentSucursal,

            ipDispositivo: deviceInfo.ipDispositivo,
            nombreDispositivo: deviceInfo.nombreDispositivo,
            sistemaOperativo: deviceInfo.sistemaOperativo,
            versionApp: deviceInfo.versionApp,

            tipoConexion: networkInfo.tipoConexion,
            tipoConexionDetallado: networkInfo.tipoConexionDetallado,
            estadoConexion: networkInfo.estadoConexion,
            intensidadSenal: networkInfo.intensidadSenal,
            esConexionMetered: networkInfo.esConexionMetered,

            ultimoAppState: this.lastAppState,
            ultimaPantalla: this.lastScreen,
            razonCierre: null,

            enviado: false,
            fechaEnvio: null,
          },
          UpdateMode.Modified,
        );
      });
    } catch (error) {
      console.error('[BitacoraService] Error persistiendo sesión de app:', error);
    }
  }

  private async flushPendingAppLogs(): Promise<void> {
    if (!this.realm || this.realm.isClosed) {
      return;
    }

    try {
      await this.persistSesionAppIfNeeded();
    } catch (error) {
      console.warn('[BitacoraService] Error persistiendo sesión de app:', error);
    }

    if (this.pendingAppEvents.length === 0) {
      return;
    }

    try {
      const eventsToFlush = [...this.pendingAppEvents];
      this.pendingAppEvents = [];

      this.realm.write(() => {
        for (const evt of eventsToFlush) {
          this.realm!.create('BitacoraAppEvento', evt, UpdateMode.Modified);
        }
      });
    } catch (error) {
      console.warn('[BitacoraService] Error enviando eventos pendientes:', error);
    }
  }

  clearUserContext(): void {
    this.currentUserId = null;
    this.currentUserName = null;
    this.currentSucursal = 1;

    try {
      if (this.realm && this.currentAppSessionId) {
        this.realm.write(() => {
          const sesion: any = this.realm!.objectForPrimaryKey(
            'BitacoraAppSesion',
            this.currentAppSessionId!,
          );
          if (sesion) {
            sesion.idUsuario = null;
            sesion.nombreUsuario = null;
            sesion.sucursal = 1;
          }
        });
      }
    } catch (error) {
      console.warn(
        '[BitacoraService] No se pudo limpiar contexto de usuario',
        error,
      );
    }
  }

  private actualizarSesionApp(fields: {
    ultimoAppState?: string | null;
    ultimaPantalla?: string | null;
    razonCierre?: string | null;
  }): void {
    if (!this.realm || !this.currentAppSessionId) {
      return;
    }

    try {
      this.realm.write(() => {
        const sesion: any = this.realm!.objectForPrimaryKey(
          'BitacoraAppSesion',
          this.currentAppSessionId!,
        );

        if (!sesion) {
          return;
        }

        if (typeof fields.ultimoAppState !== 'undefined') {
          sesion.ultimoAppState = fields.ultimoAppState;
        }

        if (typeof fields.ultimaPantalla !== 'undefined') {
          sesion.ultimaPantalla = fields.ultimaPantalla;
        }

        if (typeof fields.razonCierre !== 'undefined') {
          sesion.razonCierre = fields.razonCierre;
        }
      });
    } catch (error) {
      console.warn(
        '[BitacoraService] Error actualizando sesión de app',
        error,
      );
    }
  }

  finalizarSesionApp(razonCierre: string): void {
    if (!this.realm || !this.currentAppSessionId) {
      return;
    }

    const fechaFinal = new Date();

    try {
      this.realm.write(() => {
        const sesion: any = this.realm!.objectForPrimaryKey(
          'BitacoraAppSesion',
          this.currentAppSessionId!,
        );

        if (sesion && !sesion.fechaFinal) {
          sesion.fechaFinal = fechaFinal;
          sesion.duracionTotalMs =
            fechaFinal.getTime() - sesion.fechaInicio.getTime();
          sesion.razonCierre = razonCierre;
        }
      });
    } catch (error) {
      console.warn('[BitacoraService] Error finalizando sesión de app', error);
    }
  }

  async iniciarSesionApp(params?: {
    appState?: string | null;
    pantalla?: string | null;
  }): Promise<string> {
    if (this.currentAppSessionId) {
      if (params && typeof params.appState !== 'undefined') {
        this.lastAppState = params.appState ?? null;
      }

      if (params && typeof params.pantalla !== 'undefined') {
        this.lastScreen = params.pantalla ?? null;
      }

      this.actualizarSesionApp({
        ultimoAppState: this.lastAppState,
        ultimaPantalla: this.lastScreen,
      });

      await this.persistSesionAppIfNeeded();
      return this.currentAppSessionId;
    }

    const id = this.generateBitacoraId();
    const fechaInicio = new Date();

    const appState = params?.appState ?? null;
    const pantalla = params?.pantalla ?? null;

    this.currentAppSessionId = id;
    this.currentAppSessionStart = fechaInicio;
    this.lastAppState = appState;
    this.lastScreen = pantalla;

    if (!this.realm) {
      console.warn('[BitacoraService] Realm no inicializado');
      return id;
    }

    await this.persistSesionAppIfNeeded();
    await this.flushPendingAppLogs();

    return id;
  }

  async registrarEventoApp(params: {
    tipo: string;
    pantalla?: string | null;
    accion?: string | null;
    descripcion?: string | null;
    detalles?: any;
  }): Promise<string> {
    const id = this.generateBitacoraId();
    const idEventoMovil = `APP-EVT-${id}`;
    const fecha = new Date();

    if (!this.currentAppSessionId) {
      await this.iniciarSesionApp({
        appState: this.lastAppState,
        pantalla: this.lastScreen,
      });
    }

    if (this.realm && this.pendingAppEvents.length > 0) {
      await this.flushPendingAppLogs();
    }

    const sesionId = this.currentAppSessionId || id;

    let detallesJSON: string | null = null;
    if (typeof params.detalles !== 'undefined') {
      try {
        detallesJSON = JSON.stringify(params.detalles);
      } catch (error) {
        detallesJSON = JSON.stringify({
          error: 'detalles_no_serializables',
        });
      }
    }

    const pantalla = params.pantalla ?? this.lastScreen;

    const record = {
      id,
      idEventoMovil,
      sesionId,
      fecha,

      tipo: params.tipo,
      pantalla: pantalla ?? null,
      accion: params.accion ?? null,
      descripcion: params.descripcion ?? null,
      detallesJSON,

      idUsuario: this.currentUserId,
      nombreUsuario: this.currentUserName,
      sucursal: this.currentSucursal,

      enviado: false,
      fechaEnvio: null,
    };

    if (!this.realm) {
      this.pendingAppEvents.push(record);
      if (this.pendingAppEvents.length > 200) {
        this.pendingAppEvents.shift();
      }
      return id;
    }

    try {
      this.realm.write(() => {
        this.realm!.create('BitacoraAppEvento', record, UpdateMode.Modified);
      });
    } catch (error) {
      console.error('[BitacoraService] Error registrando evento de app:', error);
    }

    return id;
  }

  registrarCambioAppState(nextState: string): void {
    const prevState = this.lastAppState;
    this.lastAppState = nextState;

    this.actualizarSesionApp({ ultimoAppState: nextState });

    void this.registrarEventoApp({
      tipo: 'app_state',
      accion: nextState,
      descripcion: prevState ? `${prevState} -> ${nextState}` : nextState,
      detalles: {
        prevState,
        nextState,
      },
    });
  }

  registrarCambioPantalla(pantalla: string): void {
    const prevScreen = this.lastScreen;
    this.lastScreen = pantalla;

    this.actualizarSesionApp({ ultimaPantalla: pantalla });

    void this.registrarEventoApp({
      tipo: 'screen_view',
      pantalla,
      descripcion: prevScreen ? `${prevScreen} -> ${pantalla}` : pantalla,
      detalles: {
        prevScreen,
        pantalla,
      },
    });
  }

  /**
   * Obtiene bitácoras pendientes de envío de los últimos 3 días
   */
  getBitacorasPendientes(): BitacoraEntry[] {
    if (!this.realm) return [];

    const tresDiasAtras = new Date();
    tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);

    try {
      const bitacoras = this.realm
        .objects('BitacoraSync')
        .filtered('enviado == false AND fechaInicio >= $0', tresDiasAtras)
        .sorted('fechaInicio', false);

      return Array.from(bitacoras).map((b: any) => ({
        id: b.id,
        idBitacoraMovil: b.idBitacoraMovil,
        fechaInicio: b.fechaInicio,
        fechaFinal: b.fechaFinal,
        duracionMs: b.duracionMs,
        idUsuario: b.idUsuario,
        nombreUsuario: b.nombreUsuario,
        ipDispositivo: b.ipDispositivo,
        nombreDispositivo: b.nombreDispositivo,
        sistemaOperativo: b.sistemaOperativo,
        versionApp: b.versionApp,
        tipoConexion: b.tipoConexion,
        tipoConexionDetallado: b.tipoConexionDetallado,
        estadoConexion: b.estadoConexion,
        intensidadSenal: b.intensidadSenal,
        velocidadDescargaMbps: b.velocidadDescargaMbps,
        velocidadCargaMbps: b.velocidadCargaMbps,
        latenciaMs: b.latenciaMs,
        esConexionMetered: b.esConexionMetered,
        sucursal: b.sucursal,
        tabla: b.tabla,
        tipoSync: b.tipoSync,
        endpoint: b.endpoint,
        registrosLeidos: b.registrosLeidos,
        registrosGuardados: b.registrosGuardados,
        registrosActualizados: b.registrosActualizados,
        registrosEliminados: b.registrosEliminados,
        exitoso: b.exitoso,
        codigoError: b.codigoError,
        descripcionError: b.descripcionError,
        stackTrace: b.stackTrace,
        detallesJSON: b.detallesJSON,
        enviado: b.enviado,
        fechaEnvio: b.fechaEnvio,
      }));
    } catch (error) {
      console.error(
        '[BitacoraService] Error obteniendo bitácoras pendientes:',
        error,
      );
      return [];
    }
  }

  /**
   * Obtiene sesiones pendientes de envío de los últimos 3 días
   */
  getSesionesPendientes(): BitacoraSesion[] {
    if (!this.realm) return [];

    const tresDiasAtras = new Date();
    tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);

    try {
      const sesiones = this.realm
        .objects('BitacoraSesion')
        .filtered('enviado == false AND fechaInicio >= $0', tresDiasAtras)
        .sorted('fechaInicio', false);

      return Array.from(sesiones).map((s: any) => ({
        id: s.id,
        idSesionMovil: s.idSesionMovil,
        fechaInicio: s.fechaInicio,
        fechaFinal: s.fechaFinal,
        duracionTotalMs: s.duracionTotalMs,
        idUsuario: s.idUsuario,
        nombreUsuario: s.nombreUsuario,
        ipDispositivo: s.ipDispositivo,
        nombreDispositivo: s.nombreDispositivo,
        sucursal: s.sucursal,
        tipoSync: s.tipoSync,
        totalTablas: s.totalTablas,
        tablasExitosas: s.tablasExitosas,
        tablasConError: s.tablasConError,
        totalRegistros: s.totalRegistros,
        exitoso: s.exitoso,
        resumenErrores: s.resumenErrores,
        enviado: s.enviado,
        fechaEnvio: s.fechaEnvio,
      }));
    } catch (error) {
      console.error(
        '[BitacoraService] Error obteniendo sesiones pendientes:',
        error,
      );
      return [];
    }
  }

  /**
   * Envía bitácoras pendientes al servidor
   */
  async enviarBitacorasPendientes(): Promise<{
    success: boolean;
    enviadas: number;
    error?: string;
  }> {
    const bitacoras = this.getBitacorasPendientes();

    if (bitacoras.length === 0) {
      console.log('[BitacoraService] No hay bitácoras pendientes para enviar');
      return { success: true, enviadas: 0 };
    }

    console.log(
      `[BitacoraService] 📤 Enviando ${bitacoras.length} bitácoras al servidor...`,
    );

    try {
      // Preparar payload para el servidor
      const payload = bitacoras.map(b => ({
        idBitacoraMovil: b.idBitacoraMovil,
        fechaInicio: b.fechaInicio.toISOString(),
        fechaFinal: b.fechaFinal?.toISOString() || null,
        duracionMs: b.duracionMs,
        idUsuario: b.idUsuario,
        nombreUsuario: b.nombreUsuario,
        ipDispositivo: b.ipDispositivo,
        nombreDispositivo: b.nombreDispositivo,
        sistemaOperativo: b.sistemaOperativo,
        versionApp: b.versionApp,
        tipoConexion: b.tipoConexion,
        tipoConexionDetallado: b.tipoConexionDetallado,
        estadoConexion: b.estadoConexion,
        intensidadSenal: b.intensidadSenal,
        velocidadDescargaMbps: b.velocidadDescargaMbps,
        velocidadCargaMbps: b.velocidadCargaMbps,
        latenciaMs: b.latenciaMs,
        esConexionMetered: b.esConexionMetered,
        sucursal: b.sucursal,
        tabla: b.tabla,
        tipoSync: b.tipoSync,
        endpoint: b.endpoint,
        registrosLeidos: b.registrosLeidos,
        registrosGuardados: b.registrosGuardados,
        registrosActualizados: b.registrosActualizados,
        registrosEliminados: b.registrosEliminados,
        exitoso: b.exitoso,
        codigoError: b.codigoError,
        descripcionError: b.descripcionError,
        stackTrace: b.stackTrace,
        detallesJSON: b.detallesJSON,
      }));

      const url = `${
        this.apiBaseUrl
      }/api/MovilesVentas/sp_BitacoraSyncArrastreJSON?sucursal=${
        this.currentSucursal
      }&idUsuario=${this.currentUserId || 0}`;

      // ============ DEBUG LOGS ============
      console.log('[BitacoraService] 🔗 URL:', url);
      console.log(
        '[BitacoraService] 📦 Payload (primeros 2):',
        JSON.stringify(payload.slice(0, 2), null, 2),
      );
      console.log(
        '[BitacoraService] 📦 Total registros en payload:',
        payload.length,
      );
      // =====================================

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/octet-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // ============ DEBUG LOGS ============
      console.log('[BitacoraService] 📡 Response status:', response.status);
      console.log('[BitacoraService] 📡 Response ok:', response.ok);
      // =====================================

      const responseText = await response.text().catch(() => '');
      console.log('[BitacoraService] 📡 Response body:', responseText);

      if (!response.ok) {
        console.error('[BitacoraService] ❌ Error HTTP:', {
          status: response.status,
          statusText: response.statusText,
          body: responseText,
          url: url,
        });
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      // Eliminar bitácoras enviadas exitosamente de Realm
      if (this.realm) {
        this.realm.write(() => {
          for (const bitacora of bitacoras) {
            const record: any = this.realm!.objectForPrimaryKey(
              'BitacoraSync',
              bitacora.id,
            );
            if (record) {
              this.realm!.delete(record);
            }
          }
        });
      }

      console.log(
        `[BitacoraService] ✅ ${bitacoras.length} bitácoras enviadas y eliminadas de Realm`,
      );
      return { success: true, enviadas: bitacoras.length };
    } catch (error: any) {
      console.error('[BitacoraService] ❌ Error enviando bitácoras:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
      });
      return {
        success: false,
        enviadas: 0,
        error: error.message || 'Error desconocido',
      };
    }
  }

  /**
   * Envía sesiones pendientes al servidor
   */
  async enviarSesionesPendientes(): Promise<{
    success: boolean;
    enviadas: number;
    error?: string;
  }> {
    const sesiones = this.getSesionesPendientes();

    if (sesiones.length === 0) {
      console.log('[BitacoraService] No hay sesiones pendientes para enviar');
      return { success: true, enviadas: 0 };
    }

    console.log(
      `[BitacoraService] 📤 Enviando ${sesiones.length} sesiones al servidor...`,
    );

    try {
      const payload = sesiones.map(s => ({
        idSesionMovil: s.idSesionMovil,
        fechaInicio: s.fechaInicio.toISOString(),
        fechaFinal: s.fechaFinal?.toISOString() || null,
        duracionTotalMs: s.duracionTotalMs,
        idUsuario: s.idUsuario,
        nombreUsuario: s.nombreUsuario,
        ipDispositivo: s.ipDispositivo,
        nombreDispositivo: s.nombreDispositivo,
        sucursal: s.sucursal,
        tipoSync: s.tipoSync,
        totalTablas: s.totalTablas,
        tablasExitosas: s.tablasExitosas,
        tablasConError: s.tablasConError,
        totalRegistros: s.totalRegistros,
        exitoso: s.exitoso,
        resumenErrores: s.resumenErrores,
      }));

      const url = `${
        this.apiBaseUrl
      }/api/MovilesVentas/sp_BitacoraSyncSesionArrastreJSON?sucursal=${
        this.currentSucursal
      }&idUsuario=${this.currentUserId || 0}`;

      // ============ DEBUG LOGS ============
      console.log('[BitacoraService] 🔗 URL Sesiones:', url);
      console.log(
        '[BitacoraService] 📦 Payload Sesiones (primeros 2):',
        JSON.stringify(payload.slice(0, 2), null, 2),
      );
      console.log(
        '[BitacoraService] 📦 Total sesiones en payload:',
        payload.length,
      );
      // =====================================

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/octet-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // ============ DEBUG LOGS ============
      console.log(
        '[BitacoraService] 📡 Response Sesiones status:',
        response.status,
      );
      console.log('[BitacoraService] 📡 Response Sesiones ok:', response.ok);
      // =====================================

      const responseText = await response.text().catch(() => '');
      console.log('[BitacoraService] 📡 Response Sesiones body:', responseText);

      if (!response.ok) {
        console.error('[BitacoraService] ❌ Error HTTP Sesiones:', {
          status: response.status,
          statusText: response.statusText,
          body: responseText,
          url: url,
        });
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      // Eliminar sesiones enviadas exitosamente de Realm
      if (this.realm) {
        this.realm.write(() => {
          for (const sesion of sesiones) {
            const record: any = this.realm!.objectForPrimaryKey(
              'BitacoraSesion',
              sesion.id,
            );
            if (record) {
              this.realm!.delete(record);
            }
          }
        });
      }

      console.log(
        `[BitacoraService] ✅ ${sesiones.length} sesiones enviadas y eliminadas de Realm`,
      );
      return { success: true, enviadas: sesiones.length };
    } catch (error: any) {
      console.error('[BitacoraService] ❌ Error enviando sesiones:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
      });
      return {
        success: false,
        enviadas: 0,
        error: error.message || 'Error desconocido',
      };
    }
  }

  /**
   * Limpia bitácoras antiguas (más de 7 días)
   */
  limpiarBitacorasAntiguas(): number {
    if (!this.realm) return 0;

    const sieteDiasAtras = new Date();
    sieteDiasAtras.setDate(sieteDiasAtras.getDate() - 7);

    let eliminadas = 0;

    try {
      this.realm.write(() => {
        // Eliminar bitácoras enviadas y antiguas
        const bitacorasAntiguas = this.realm!.objects('BitacoraSync').filtered(
          'enviado == true AND fechaInicio < $0',
          sieteDiasAtras,
        );
        eliminadas = bitacorasAntiguas.length;
        this.realm!.delete(bitacorasAntiguas);

        // Eliminar sesiones antiguas
        const sesionesAntiguas = this.realm!.objects('BitacoraSesion').filtered(
          'enviado == true AND fechaInicio < $0',
          sieteDiasAtras,
        );
        this.realm!.delete(sesionesAntiguas);

        const sesionesAppAntiguas = this.realm!
          .objects('BitacoraAppSesion')
          .filtered('fechaInicio < $0', sieteDiasAtras);
        this.realm!.delete(sesionesAppAntiguas);

        const eventosAppAntiguos = this.realm!
          .objects('BitacoraAppEvento')
          .filtered('fecha < $0', sieteDiasAtras);
        this.realm!.delete(eventosAppAntiguos);
      });

      console.log(
        `[BitacoraService] Limpieza: ${eliminadas} bitácoras antiguas eliminadas`,
      );
    } catch (error) {
      console.error('[BitacoraService] Error en limpieza:', error);
    }

    return eliminadas;
  }

  /**
   * Obtiene estadísticas de sincronización
   */
  getEstadisticas(): {
    totalBitacoras: number;
    bitacorasPendientes: number;
    bitacorasExitosas: number;
    bitacorasConError: number;
    ultimaSincronizacion: Date | null;
  } {
    if (!this.realm) {
      return {
        totalBitacoras: 0,
        bitacorasPendientes: 0,
        bitacorasExitosas: 0,
        bitacorasConError: 0,
        ultimaSincronizacion: null,
      };
    }

    try {
      const tresDiasAtras = new Date();
      tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);

      const bitacoras = this.realm
        .objects('BitacoraSync')
        .filtered('fechaInicio >= $0', tresDiasAtras);

      const pendientes = this.realm
        .objects('BitacoraSync')
        .filtered('enviado == false AND fechaInicio >= $0', tresDiasAtras);

      const exitosas = this.realm
        .objects('BitacoraSync')
        .filtered('exitoso == true AND fechaInicio >= $0', tresDiasAtras);

      const conError = this.realm
        .objects('BitacoraSync')
        .filtered('exitoso == false AND fechaInicio >= $0', tresDiasAtras);

      const ultima = this.realm
        .objects('BitacoraSync')
        .sorted('fechaInicio', true)[0] as any;

      return {
        totalBitacoras: bitacoras.length,
        bitacorasPendientes: pendientes.length,
        bitacorasExitosas: exitosas.length,
        bitacorasConError: conError.length,
        ultimaSincronizacion: ultima?.fechaInicio || null,
      };
    } catch (error) {
      console.error('[BitacoraService] Error obteniendo estadísticas:', error);
      return {
        totalBitacoras: 0,
        bitacorasPendientes: 0,
        bitacorasExitosas: 0,
        bitacorasConError: 0,
        ultimaSincronizacion: null,
      };
    }
  }
}

// Exportar instancia singleton
export const bitacoraService = new BitacoraService();
export default bitacoraService;
