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

  /**
   * Inicializa el servicio con el realm proporcionado
   */
  setRealm(realm: Realm): void {
    this.realm = realm;
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
    if (!this.cachedDeviceInfo) {
      this.cachedDeviceInfo = await deviceInfoService.getFullDeviceInfo();
    }
    return this.cachedDeviceInfo;
  }

  /**
   * Invalida el cache de información del dispositivo
   */
  invalidateDeviceInfoCache(): void {
    this.cachedDeviceInfo = null;
    deviceInfoService.invalidateIpCache();
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
