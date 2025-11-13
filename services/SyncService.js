import Realm from 'realm';

class SimpleEventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const handlers = this.listeners.get(event);
    handlers.add(handler);

    return () => this.off(event, handler);
  }

  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (!handlers) {
      return;
    }
    handlers.delete(handler);
    if (handlers.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit(event, payload) {
    const handlers = this.listeners.get(event);
    if (!handlers) {
      return;
    }
    handlers.forEach(handler => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Error en listener de evento ${event}:`, error);
      }
    });
  }
}

// Esquema para clientes en Realm
const ClienteSchema = {
  name: 'Cliente',
  properties: {
    id: 'int',
    nombre: 'string',
    email: 'string?',
    telefono: 'string?',
    domicilio: 'string?',
    ciudad: 'string?',
    estado: 'string?',
    colonia: 'string?',
    cp: 'string?',
    rfc: 'string?',
    nombre_fiscal: 'string?',
    fecha_alta: 'date?',
    suspendido: 'bool?',
    sucursal_origen: 'int?',
    fecha_act: 'date?',
    plastico_activo: 'bool?',
    fecha_nac: 'date?',
    correo_factura: 'string?',
    regimenFiscal: 'string?',
    limiteCredito: 'float?',
    dias_Credito: 'int?',
    cp_fact: 'string?',
    credito: 'bool?',
    contacto: 'string?',
    clave_lista_credito: 'int?',
    clave_lista_mayoreo: 'int?',
    medioContacto: 'int?',
    facturacion: 'bool?',
    domicilioFiscal: 'string?',
    coloniaFiscal: 'string?',
    numExteriorFiscal: 'string?',
    cpFiscal: 'string?',
    ciudadFiscal: 'string?',
    estadoFiscal: 'int?',
    usrAutorizaCreditoFiscal: 'string?',
    usrAutorizaDiasCreditoFiscal: 'string?',
    telefonoFiscal: 'string?',
    contactoFiscal: 'string?',
    emailFiscal: 'string?',
    idGrupo: 'int?',
    tipoFacturacion: 'int?',
    formaPago: 'int?',
    usoCFDI: 'int?',
    formaPagosVentas: 'int?',
    metodoPago: 'string?',
    addenda: 'bool?',
    observacion: 'bool?',
    carteraMovil: 'bool',
    syncedAt: 'date'
  },
  primaryKey: 'id'
};

const ClienteGrupoSchema = {
  name: 'ClienteGrupo',
  properties: {
    idGrupo: 'int',
    nombre: 'string?',
    descripcion: 'string?',
    activo: 'bool?',
    rawJson: 'string?',
    syncedAt: 'date'
  },
  primaryKey: 'idGrupo'
};

const ENTITY_CONFIG = {
  cat_clientes_grupos: {
    realmType: 'ClienteGrupo',
    primaryKey: 'idGrupo',
    getId: ({ notification, datos, parsedRegistro }) =>
      notification.entidadId ??
      datos.id ??
      parsedRegistro?.id ??
      parsedRegistro?.idGrupo ??
      notification.id,
    normalizeId: value => Number(value),
    mapData: ({ datos, parsedRegistro, notification }) => ({
      nombre:
        parsedRegistro?.nombreGrupo ??
        datos.nombreGrupo ??
        notification.nombreGrupo ??
        null,
      descripcion:
        parsedRegistro?.descripcion ??
        datos.descripcion ??
        parsedRegistro?.nombreGrupo ??
        '',
      activo:
        parsedRegistro?.activo ??
        datos.activo ??
        notification.activo ??
        true,
    }),
  },
};

function buildNotificationContext(notification) {
  const datos = notification?.datos ?? {};
  const registroRaw =
    datos?.registro ?? notification?.registro ?? notification?.rawJson ?? null;

  let parsedRegistro = null;
  if (registroRaw) {
    if (typeof registroRaw === 'string') {
      try {
        parsedRegistro = JSON.parse(registroRaw);
      } catch (error) {
        console.warn('Registro de notificación no es JSON válido:', error);
      }
    } else if (typeof registroRaw === 'object') {
      parsedRegistro = registroRaw;
    }
  }

  const tipoCambioRaw =
    notification?.tipoCambio ??
    datos?.tipoCambio ??
    parsedRegistro?.tipoCambio ??
    '';

  const tipoCambio = String(tipoCambioRaw).toLowerCase();

  const timestamp = notification?.fecha
    ? new Date(notification.fecha)
    : datos?.fechaEvento
    ? new Date(datos.fechaEvento)
    : new Date();

  const rawJson =
    typeof registroRaw === 'string'
      ? registroRaw
      : registroRaw != null
      ? JSON.stringify(registroRaw)
      : JSON.stringify(parsedRegistro ?? datos ?? notification);

  return {
    notification,
    datos,
    registroRaw,
    parsedRegistro,
    tipoCambio,
    timestamp,
    rawJson,
  };
}

class SyncService {
  constructor() {
    this.realm = null;
    this.isInitialized = false;
    this.apiBaseUrl = 'https://cbinfo.no-ip.info:9011'; // Para Android emulator (10.0.2.2 = host machine)
    this.events = new SimpleEventEmitter();
  }

  onEntityChange(listener) {
    return this.events.on('entityChange', listener);
  }

  onClienteGrupoChange(listener) {
    return this.events.on('clienteGrupoChange', listener);
  }

  async handleNotification(notification) {
    if (!notification) {
      console.warn('Notificación de ClienteGrupo vacía o inválida');
      return;
    }

    if (!this.isInitialized) {
      await this.initialize();
    }

    const context = buildNotificationContext(notification);
    const datos = context.datos;
    const parsedRegistro = context.parsedRegistro;

    const entityKey =
      notification.entidad ?? datos.entidad ?? parsedRegistro?.entidad ?? null;

    if (!entityKey || !ENTITY_CONFIG[entityKey]) {
      console.warn('Entidad de notificación no soportada:', entityKey, notification);
      return;
    }

    const config = ENTITY_CONFIG[entityKey];

    const idSource = config.getId({ notification, datos, parsedRegistro, context });
    const normalizedId = config.normalizeId
      ? config.normalizeId(idSource)
      : idSource;

    const primaryKey = config.primaryKey ?? 'id';

    if (
      normalizedId == null ||
      (typeof normalizedId === 'number' && !Number.isFinite(normalizedId))
    ) {
      console.warn('Notificación sin identificador válido:', notification);
      return;
    }

    const tipoCambio = context.tipoCambio;

    if (tipoCambio.includes('eliminado')) {
      this.realm.write(() => {
        const existing = this.realm.objectForPrimaryKey(
          config.realmType,
          normalizedId,
        );
        if (existing) {
          this.realm.delete(existing);
          console.log(
            `🗑️ ${config.realmType} ${normalizedId} eliminado desde notificación`,
          );
        } else {
          console.log(
            `ℹ️ Notificación de eliminación para ${config.realmType} ${normalizedId}, pero no existe en Realm`,
          );
        }
      });

      const entityEvent = {
        entidad: entityKey,
        action: 'delete',
        id: normalizedId,
        notification,
      };

      this.events.emit('entityChange', entityEvent);

      if (entityKey === 'cat_clientes_grupos') {
        this.events.emit('clienteGrupoChange', {
          ...entityEvent,
          idGrupo: normalizedId,
        });
      }

      return;
    }

    const mappedData = config.mapData({
      datos,
      parsedRegistro,
      notification,
      context,
    });

    const recordData = {
      [primaryKey]: normalizedId,
      ...mappedData,
    };

    if (config.includeRawJson !== false) {
      recordData.rawJson = context.rawJson;
    }

    if (config.includeSyncedAt !== false) {
      recordData.syncedAt = context.timestamp;
    }

    this.realm.write(() => {
      this.realm.create(config.realmType, recordData, 'modified');
    });

    console.log(`✅ ${config.realmType} ${normalizedId} sincronizado desde notificación`);

    const entityEvent = {
      entidad: entityKey,
      action: 'upsert',
      id: normalizedId,
      notification,
    };

    this.events.emit('entityChange', entityEvent);

    if (entityKey === 'cat_clientes_grupos') {
      this.events.emit('clienteGrupoChange', {
        ...entityEvent,
        idGrupo: normalizedId,
      });
    }
  }

  async upsertClienteGrupoFromNotification(notification) {
    return this.handleNotification({
      ...notification,
      entidad:
        notification?.entidad ??
        notification?.datos?.entidad ??
        'cat_clientes_grupos',
    });
  }

  async syncClienteGrupos() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const endpoint = `${this.apiBaseUrl}/api/SincronizacionMovil/sp_movil_syncro_cat_clientes_grupos_get`;

    console.log('Debug: Fetching URL for syncClienteGrupos:', endpoint);

    try {
      console.log('🔄 Iniciando sincronización de grupos de clientes...');
      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const serverGroups = await response.json();

      if (!Array.isArray(serverGroups)) {
        throw new Error('La respuesta del servidor no es un array válido');
      }

      this.realm.write(() => {
        serverGroups.forEach(group => {
          const groupData = {
            idGrupo: group.idGrupo ?? group.id ?? 0,
            rawJson: JSON.stringify(group),
            syncedAt: new Date(),
          };
          const existing = this.realm.objectForPrimaryKey('ClienteGrupo', groupData.idGrupo);
          if (existing) {
            this.realm.create('ClienteGrupo', groupData, 'modified');
          } else {
            this.realm.create('ClienteGrupo', groupData);
          }
        });
      });

      console.log(`✅ Sincronización de grupos completada`);

      this.events.emit('clienteGrupoChange', {
        source: 'sync',
        total: serverGroups.length,
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error al sincronizar grupos de clientes:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  getClienteGrupos(limit = 100) {
    if (!this.isInitialized) {
      return [];
    }

    return this.realm
      .objects('ClienteGrupo')
      .sorted('nombre')
      .slice(0, limit);
  }

  clearClienteGrupos() {
    if (!this.isInitialized) {
      return;
    }

    this.realm.write(() => {
      this.realm.delete(this.realm.objects('ClienteGrupo'));
    });
    console.log('🗑️ Todos los grupos de clientes eliminados de la base local');
  }

  // Inicializar base de datos Realm
  async initialize() {
    try {
      this.realm = await Realm.open({
        path: 'ClientesDB',
        schema: [ClienteSchema, ClienteGrupoSchema],
        schemaVersion: 3, // Incrementar versión para incorporar ClienteGrupo
        migration: (oldRealm, newRealm) => {
          console.log('🔄 Ejecutando migración de Realm...');

          if (oldRealm.schemaVersion < 2) {
            const oldObjects = oldRealm.objects('Cliente');
            const newObjects = newRealm.objects('Cliente');

            for (let i = 0; i < oldObjects.length; i++) {
              const newObj = newObjects[i];

              if (newObj.suspendido === undefined) {
                newObj.suspendido = false;
              }
              if (newObj.plastico_activo === undefined) {
                newObj.plastico_activo = false;
              }
              if (newObj.clave_lista_credito === undefined) {
                newObj.clave_lista_credito = 1;
              }
              if (newObj.clave_lista_mayoreo === undefined) {
                newObj.clave_lista_mayoreo = 1;
              }
            }

            console.log(`✅ Migración completada para ${oldObjects.length} clientes`);
          }

          if (oldRealm.schemaVersion < 3) {
            // No se requiere migración adicional; la nueva tabla se crea automáticamente
            console.log('🆕 Esquema ClienteGrupo disponible a partir de la versión 3');
          }
        }
      });
      
      this.isInitialized = true;
      console.log('✅ SyncService inicializado con Realm');
    } catch (error) {
      console.error('❌ Error inicializando SyncService:', error);
      throw error;
    }
  }

  // Sincronizar clientes desde el servidor
  async syncClients() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('🔄 Iniciando sincronización de clientes...');
      
      // Obtener clientes del servidor
      const response = await fetch(`${this.apiBaseUrl}/api/SincronizacionMovil/sp_movil_syncro_cliente_getVersion2`);
      console.log(response);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const serverClients = await response.json();
      
      if (!Array.isArray(serverClients)) {
        throw new Error('La respuesta del servidor no es un array válido');
      }
      
      console.log(`📥 ${serverClients.length} clientes recibidos del servidor`);
      
      // Obtener clientes locales actuales
      const localClients = this.realm.objects('Cliente');
      console.log(`📊 ${localClients.length} clientes en la base local`);
      
      // Crear mapa de clientes del servidor para comparación
      const serverClientsMap = new Map(
        serverClients.map(client => [client.id, client])
      );
      
      // Identificar clientes a eliminar (existen localmente pero no en servidor)
      const clientsToDelete = localClients.filter(client => !serverClientsMap.has(client.id));
      
      if (clientsToDelete.length > 0) {
        console.log(`🗑️ ${clientsToDelete.length} clientes serán eliminados`);
        this.realm.write(() => {
          this.realm.delete(clientsToDelete);
        });
      }
      
      // Procesar clientes del servidor (agregar o actualizar)
      let nuevos = 0;
      let actualizados = 0;
      
      this.realm.write(() => {
        serverClients.forEach(client => {
          const clienteData = {
            ...client,
            syncedAt: new Date(),
            // Valores por defecto para propiedades faltantes
            suspendido: client.suspendido !== undefined ? client.suspendido : false,
            plastico_activo: client.plastico_activo !== undefined ? client.plastico_activo : false,
            carteraMovil: client.carteraMovil !== undefined ? client.carteraMovil : true,
            clave_lista_credito: client.clave_lista_credito !== undefined ? client.clave_lista_credito : 1,
            clave_lista_mayoreo: client.clave_lista_mayoreo !== undefined ? client.clave_lista_mayoreo : 1,
            credito: client.credito !== undefined ? client.credito : false,
            facturacion: client.facturacion !== undefined ? client.facturacion : false,
            observacion: client.observacion !== undefined ? client.observacion : false,
            addenda: client.addenda !== undefined ? client.addenda : false,
            // Convertir fechas de string a date si es necesario
            fecha_alta: client.fecha_alta ? new Date(client.fecha_alta) : null,
            fecha_act: client.fecha_act ? new Date(client.fecha_act) : null,
            fecha_nac: client.fecha_nac ? new Date(client.fecha_nac) : null,
          };
          
          const existingClient = this.realm.objectForPrimaryKey('Cliente', client.id);
          
          if (existingClient) {
            // Actualizar cliente existente
            Object.assign(existingClient, clienteData);
            actualizados++;
          } else {
            // Crear nuevo cliente
            this.realm.create('Cliente', clienteData);
            nuevos++;
          }
        });
      });
      
      console.log(`✅ Sincronización completada: ${nuevos} nuevos, ${actualizados} actualizados, ${clientsToDelete.length} eliminados`);
      
      return {
        success: true,
        nuevos,
        actualizados,
        eliminados: clientsToDelete.length,
        total: serverClients.length
      };
      
    } catch (error) {
      console.error('❌ Error en sincronización:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Obtener todos los clientes locales
  getClients(limit = 100) {
    if (!this.isInitialized) {
      return [];
    }
    
    return this.realm.objects('Cliente')
      .sorted('nombre')
      .slice(0, limit);
  }

  // Obtener cliente por ID
  getClientById(id) {
    if (!this.isInitialized) {
      return null;
    }
    
    return this.realm.objectForPrimaryKey('Cliente', id);
  }

  // Buscar clientes por nombre
  searchClients(query, limit = 50) {
    if (!this.isInitialized) {
      return [];
    }
    
    if (!query.trim()) {
      return this.getClients(limit);
    }
    
    return this.realm.objects('Cliente')
      .filtered('nombre CONTAINS[c] $0', query)
      .sorted('nombre')
      .slice(0, limit);
  }

  // Obtener estadísticas de sincronización
  getSyncStats() {
    if (!this.isInitialized) {
      return { total: 0, lastSync: null };
    }
    
    const clients = this.realm.objects('Cliente');
    const lastSync = clients.length > 0 ? 
      clients.max('syncedAt') : null;
    
    return {
      total: clients.length,
      lastSync,
      synced: clients.filtered('syncedAt != null').length
    };
  }

  // Eliminar todos los clientes locales
  clearAllClients() {
    if (!this.isInitialized) {
      return;
    }
    
    this.realm.write(() => {
      this.realm.delete(this.realm.objects('Cliente'));
    });
    
    console.log('🗑️ Todos los clientes eliminados de la base local');
  }

  // Cerrar conexión a Realm
  close() {
    if (this.realm && !this.realm.isClosed) {
      this.realm.close();
      console.log('🔒 Conexión a Realm cerrada');
    }
  }
}

export default new SyncService();
