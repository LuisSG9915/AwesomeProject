// Esquemas de Realm para todas las entidades

export const VentaSchema = {
  name: 'Venta',
  properties: {
    id: 'int',
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
    syncedAt: 'date'
  },
  primaryKey: 'id'
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
    syncedAt: 'date'
  },
  primaryKey: 'id'
};

export const ProductoSchema = {
  name: 'Producto',
  properties: {
    id: 'int',
    claveProd: 'string?',
    descripcion: 'string?',
    esKit: 'bool?',
    fechaAct: 'date?',
    syncedAt: 'date'
  },
  primaryKey: 'id'
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
    syncedAt: 'date'
  },
  primaryKey: 'id'
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
    syncedAt: 'date'
  },
  primaryKey: 'id'
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
    syncedAt: 'date'
  },
  primaryKey: 'id'
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
    syncedAt: 'date'
  },
  primaryKey: 'id'
};

// Esquema para controlar el estado de sincronización
export const SyncStatusSchema = {
  name: 'SyncStatus',
  properties: {
    id: 'string',
    lastSyncDate: 'date?',
    totalRecords: 'int?',
    status: 'string?' // 'completed', 'in_progress', 'failed'
  },
  primaryKey: 'id'
};

export const ALL_SCHEMAS = [
  VentaSchema,
  UsuarioSchema,
  ProductoSchema,
  PrecioSchema,
  InventarioSchema,
  CarteraSchema,
  ClienteFullSchema,
  SyncStatusSchema
];
