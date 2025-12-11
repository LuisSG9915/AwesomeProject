// Esquemas de Realm para todas las entidades

export const VentaSchema = {
  name: 'Venta',
  properties: {
    id: 'int',
    idMovil: 'int?',
    sucursal: 'int?',
    noVenta: 'int?',
    claveProd: 'int?',
    nombreProducto: 'string?',
    cantProducto: 'int?',
    precio: 'float?',
    importe: 'float?',
    cveCliente: 'int?',
    nombreCliente: 'string?',
    fecha: 'date?',
    tipoPago: 'int?',
    descripcionMedioPago: 'string?',
    vendedor: 'string?',
    folioFactura: 'bool?',
    facturacionMovil: 'bool?',
    syncedAt: 'date',
    syncedAr: 'date?',
  },
  primaryKey: 'id',
};

export const UsuarioSchema = {
  name: 'Usuario',
  properties: {
    id: 'int',
    nombre: 'string?',
    perfil: 'int?',
    descripcionPerfil: 'string?',
    puesto: 'int?',
    descripcionPuesto: 'string?',
    claveEmpleado: 'string?',
    password: 'string?',
    sucursalOrigen: 'int?',
    syncedAt: 'date',
    syncedAr: 'date?',
  },
  primaryKey: 'id',
};

export const ProductoSchema = {
  name: 'Producto',
  properties: {
    id: 'int',
    claveProd: 'string?',
    descripcion: 'string?',
    esKit: 'bool?',
    fechaAct: 'date?',
    syncedAt: 'date',
    syncedAr: 'date?',
  },
  primaryKey: 'id',
};

export const PrecioSchema = {
  name: 'Precio',
  properties: {
    id: 'string',
    descripcion: 'string?',
    idCliente: 'int?',
    claveProd: 'int?',
    precio: 'float?',
    fechaAct: 'date?',
    syncedAt: 'date',
    syncedAr: 'date?',
  },
  primaryKey: 'id',
};

export const InventarioSchema = {
  name: 'Inventario',
  properties: {
    id: 'int',
    sucursal: 'int?',
    claveProd: 'int?',
    fechaArrastre: 'date?',
    saldo: 'float?',
    descripcion: 'string?',
    syncedAt: 'date',
    syncedAr: 'date?',
  },
  primaryKey: 'id',
};

export const CarteraSchema = {
  name: 'Cartera',
  properties: {
    id: 'int',
    idCliente: 'int?',
    nombreCliente: 'string?',
    sucursal: 'int?',
    sucursalSegmento: 'int?',
    saldo: 'float?',
    fecha: 'date?',
    idSegmento: 'int?',
    noVenta: 'int?',
    cobrado: 'bool?',
    tipoPago: 'int?',
    syncedAt: 'date',
    syncedAr: 'date?',
  },
  primaryKey: 'id',
};

export const ClienteFullSchema = {
  name: 'ClienteFull',
  properties: {
    id: 'int',
    nombre: 'string?',
    longitud: 'float?',
    latitud: 'float?',
    idGrupo: 'int?',
    credito: 'bool?',
    facturacionMovil: 'bool?',
    fechaAct: 'date?',
    correoFactura: 'string?',
    syncedAt: 'date',
    syncedAr: 'date?',
  },
  primaryKey: 'id',
};

// Esquema para controlar el estado de sincronización
export const SyncStatusSchema = {
  name: 'SyncStatus',
  properties: {
    id: 'string',
    lastSyncDate: 'date?',
    totalRecords: 'int?',
    status: 'string?', // 'completed', 'in_progress', 'failed'
  },
  primaryKey: 'id',
};

/**
 * Schema para logs de sincronización
 * Registra cada sincronización con detalles completos
 */
export const SyncLogSchema = {
  name: 'SyncLog',
  properties: {
    id: 'string', // UUID único
    fechaInicio: 'date', // Fecha y hora de inicio
    fechaFinal: 'date?', // Fecha y hora de finalización
    exitoso: 'bool', // Si fue exitoso o no
    razon: 'string?', // Razón específica si falló
    usuario: 'string?', // Usuario que ejecutó la sincronización
    ruta: 'string?', // Ruta/endpoint de la API
    sucursal: 'int?', // Sucursal sincronizada
    totalRegistros: 'int?', // Total de registros sincronizados
    duracionMs: 'int?', // Duración en milisegundos
    tipo: 'string?', // 'manual' o 'automatica'
    detalles: 'string?', // JSON con detalles adicionales
  },
  primaryKey: 'id',
};

/**
 * Schema para logs de sincronización por tabla
 * Registra cada sincronización individual con detalles específicos
 */
export const SyncTableLogSchema = {
  name: 'SyncTableLog',
  properties: {
    id: 'string', // UUID único
    syncLogId: 'string', // Referencia al SyncLog principal
    tabla: 'string', // Nombre de la tabla sincronizada
    fechaInicio: 'date', // Fecha y hora de inicio de esta tabla
    fechaFinal: 'date?', // Fecha y hora de finalización
    exitoso: 'bool', // Si fue exitoso o no
    razon: 'string?', // Razón específica si falló
    registrosLeidos: 'int?', // Total de registros leídos de la API
    registrosGuardados: 'int?', // Total de registros guardados en Realm
    registrosActualizados: 'int?', // Total de registros actualizados
    duracionMs: 'int?', // Duración en milisegundos
    endpoint: 'string?', // Endpoint específico de esta tabla
    detalles: 'string?', // JSON con detalles adicionales
  },
  primaryKey: 'id',
};

// ============================================================================
// SCHEMAS DE BITÁCORA COMPLETA
// ============================================================================

/**
 * Schema para bitácora detallada de sincronización por tabla
 * Incluye información completa: usuario, dispositivo, IP, errores detallados
 */
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
    tipoSync: 'string', // 'completa', 'incremental', 'manual'
    endpoint: 'string?',

    // Estadísticas
    registrosLeidos: 'int',
    registrosGuardados: 'int',
    registrosActualizados: 'int',
    registrosEliminados: 'int',

    // Estado y errores
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

/**
 * Schema para bitácora de sesiones de sincronización
 * Agrupa múltiples sincronizaciones de tablas en una sesión
 */
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

export const ALL_SCHEMAS = [
  VentaSchema,
  UsuarioSchema,
  ProductoSchema,
  PrecioSchema,
  InventarioSchema,
  CarteraSchema,
  ClienteFullSchema,
  SyncStatusSchema,
  SyncLogSchema,
  SyncTableLogSchema,
  BitacoraSyncSchema,
  BitacoraSesionSchema,
];
