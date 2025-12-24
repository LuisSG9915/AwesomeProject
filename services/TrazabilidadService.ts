import Realm from 'realm';
import {Platform} from 'react-native';
import NetInfo from '@react-native-community/netinfo';

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

interface TrazabilidadData {
  pantalla: string;
  accion: string;
  tipoElemento?: string;
  etiqueta?: string;
  parametros?: any;
}

interface TrazabilidadResult {
  exitoso: boolean;
  codigoError?: string;
  mensajeError?: string;
  resultado?: any;
}

class TrazabilidadService {
  private realm: Realm | null = null;
  private currentUser: {id: number; nombre: string; sucursal: number} | null = null;
  private deviceId: string = '';
  private deviceInfo: any = {};
  private pendingActions: Map<string, {startTime: number; data: TrazabilidadData}> = new Map();

  async initialize() {
    try {
      this.deviceId = uuidv4();
      this.deviceInfo = {
        nombre: Platform.OS === 'ios' ? 'iOS Device' : 'Android Device',
        sistemaOperativo: `${Platform.OS} ${Platform.Version}`,
        versionApp: '1.0.0',
      };
    } catch (error) {
      console.error('Error inicializando TrazabilidadService:', error);
    }
  }

  setRealm(realmInstance: Realm) {
    this.realm = realmInstance;
  }

  setCurrentUser(user: {id: number; nombre: string; sucursal: number} | null) {
    this.currentUser = user;
  }

  async registrarInicio(data: TrazabilidadData): Promise<string> {
    const actionId = uuidv4();
    this.pendingActions.set(actionId, {
      startTime: Date.now(),
      data,
    });
    return actionId;
  }

  async registrarFinal(actionId: string, result: TrazabilidadResult) {
    const pending = this.pendingActions.get(actionId);
    if (!pending) {
      console.warn('No se encontró acción pendiente:', actionId);
      return;
    }

    const duracionMs = Date.now() - pending.startTime;
    this.pendingActions.delete(actionId);

    await this.guardarTrazabilidad({
      ...pending.data,
      fechaInicio: new Date(pending.startTime),
      fechaFinal: new Date(),
      duracionMs,
      ...result,
    });
  }

  async registrarAccionCompleta(data: TrazabilidadData, result: TrazabilidadResult) {
    await this.guardarTrazabilidad({
      ...data,
      fechaInicio: new Date(),
      fechaFinal: new Date(),
      duracionMs: 0,
      ...result,
    });
  }

  private async guardarTrazabilidad(data: any) {
    if (!this.realm) {
      console.warn('Realm no inicializado en TrazabilidadService');
      return;
    }

    try {
      let ipDispositivo = 'unknown';
      try {
        const netInfo = await NetInfo.fetch();
        ipDispositivo = (netInfo.details as any)?.ipAddress || 'unknown';
      } catch (e) {
        console.warn('No se pudo obtener IP:', e);
      }

      this.realm.write(() => {
        this.realm!.create('TrazabilidadMovil', {
          id: uuidv4(),
          idMovil: this.deviceId,
          
          idUsuario: this.currentUser?.id || null,
          nombreUsuario: this.currentUser?.nombre || null,
          sucursal: this.currentUser?.sucursal || null,
          
          fechaInicio: data.fechaInicio,
          fechaFinal: data.fechaFinal || null,
          duracionMs: data.duracionMs || null,
          
          pantalla: data.pantalla,
          accion: data.accion,
          tipoElemento: data.tipoElemento || null,
          etiqueta: data.etiqueta || null,
          
          exitoso: data.exitoso,
          codigoError: data.codigoError || null,
          mensajeError: data.mensajeError || null,
          
          parametros: data.parametros ? JSON.stringify(data.parametros) : null,
          resultado: data.resultado ? JSON.stringify(data.resultado) : null,
          
          ipDispositivo,
          nombreDispositivo: this.deviceInfo.nombre || null,
          sistemaOperativo: this.deviceInfo.sistemaOperativo || null,
          versionApp: this.deviceInfo.versionApp || null,
          
          enviado: false,
          fechaEnvio: null,
          intentosEnvio: 0,
        });
      });
    } catch (error) {
      console.error('Error guardando trazabilidad:', error);
    }
  }

  async obtenerTrazabilidadPendiente(): Promise<any[]> {
    if (!this.realm) {
      return [];
    }

    try {
      const registros = this.realm
        .objects('TrazabilidadMovil')
        .filtered('enviado == false')
        .sorted('fechaInicio', false);

      return Array.from(registros).map(r => ({
        id: r.id,
        idMovil: r.idMovil,
        idUsuario: r.idUsuario,
        nombreUsuario: r.nombreUsuario,
        sucursal: r.sucursal,
        fechaInicio: r.fechaInicio,
        fechaFinal: r.fechaFinal,
        duracionMs: r.duracionMs,
        pantalla: r.pantalla,
        accion: r.accion,
        tipoElemento: r.tipoElemento,
        etiqueta: r.etiqueta,
        exitoso: r.exitoso,
        codigoError: r.codigoError,
        mensajeError: r.mensajeError,
        parametros: r.parametros,
        resultado: r.resultado,
        ipDispositivo: r.ipDispositivo,
        nombreDispositivo: r.nombreDispositivo,
        sistemaOperativo: r.sistemaOperativo,
        versionApp: r.versionApp,
      }));
    } catch (error) {
      console.error('Error obteniendo trazabilidad pendiente:', error);
      return [];
    }
  }

  async marcarComoEnviado(ids: string[]) {
    if (!this.realm || ids.length === 0) {
      return;
    }

    try {
      this.realm.write(() => {
        ids.forEach(id => {
          const registro = this.realm!.objectForPrimaryKey('TrazabilidadMovil', id);
          if (registro) {
            registro.enviado = true;
            registro.fechaEnvio = new Date();
          }
        });
      });
    } catch (error) {
      console.error('Error marcando trazabilidad como enviada:', error);
    }
  }

  async incrementarIntentosEnvio(ids: string[]) {
    if (!this.realm || ids.length === 0) {
      return;
    }

    try {
      this.realm.write(() => {
        ids.forEach(id => {
          const registro = this.realm!.objectForPrimaryKey('TrazabilidadMovil', id);
          if (registro) {
            const intentosActuales = (registro as any).intentosEnvio || 0;
            (registro as any).intentosEnvio = intentosActuales + 1;
          }
        });
      });
    } catch (error) {
      console.error('Error incrementando intentos de envío:', error);
    }
  }

  async limpiarRegistrosAntiguos(diasRetencion: number = 30) {
    if (!this.realm) {
      return;
    }

    try {
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() - diasRetencion);

      this.realm.write(() => {
        const registrosAntiguos = this.realm!
          .objects('TrazabilidadMovil')
          .filtered('enviado == true AND fechaEnvio < $0', fechaLimite);
        
        this.realm!.delete(registrosAntiguos);
      });
    } catch (error) {
      console.error('Error limpiando registros antiguos:', error);
    }
  }

  wrapOnClick<T extends (...args: any[]) => any>(
    handler: T,
    pantalla: string,
    accion: string,
    tipoElemento: string = 'button',
    etiqueta?: string
  ): T {
    return (async (...args: any[]) => {
      const actionId = await this.registrarInicio({
        pantalla,
        accion,
        tipoElemento,
        etiqueta,
        parametros: args.length > 0 ? {args} : undefined,
      });

      try {
        const resultado = await handler(...args);
        await this.registrarFinal(actionId, {
          exitoso: true,
          resultado: resultado !== undefined ? {value: resultado} : undefined,
        });
        return resultado;
      } catch (error: any) {
        await this.registrarFinal(actionId, {
          exitoso: false,
          codigoError: error.code || 'ERROR',
          mensajeError: error.message || String(error),
        });
        throw error;
      }
    }) as T;
  }
}

export default new TrazabilidadService();
