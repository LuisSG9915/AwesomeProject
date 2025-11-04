import Realm from 'realm';

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

class SyncService {
  constructor() {
    this.realm = null;
    this.isInitialized = false;
    this.apiBaseUrl = 'https://cbinfo.no-ip.info:9011'; // Para Android emulator (10.0.2.2 = host machine)
  }

  // Inicializar base de datos Realm
  async initialize() {
    try {
      this.realm = await Realm.open({
        path: 'ClientesDB',
        schema: [ClienteSchema],
        schemaVersion: 2, // Incrementar versión para forzar migración
        migration: (oldRealm, newRealm) => {
          console.log('🔄 Ejecutando migración de Realm...');
          
          // Migración de la versión 1 a la 2
          if (oldRealm.schemaVersion < 2) {
            const oldObjects = oldRealm.objects('Cliente');
            const newObjects = newRealm.objects('Cliente');
            
            // Iterar sobre todos los clientes existentes y asegurar que tengan valores por defecto
            for (let i = 0; i < oldObjects.length; i++) {
              const oldObj = oldObjects[i];
              const newObj = newObjects[i];
              
              // Asignar valores por defecto para propiedades que ahora son opcionales
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
