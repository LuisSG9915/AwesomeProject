# Sistema de Sincronización Completo con Realm Database

## 📋 Descripción

Sistema completo de sincronización de datos que se ejecuta automáticamente al iniciar sesión. Los datos se almacenan localmente en Realm Database y pueden visualizarse en la aplicación.

## ✨ Características Implementadas

### 1. **Sincronización Automática al Login**
- Se ejecuta automáticamente después de un login exitoso
- Muestra progreso en tiempo real (1 de 7, 2 de 7, etc.)
- Modal visual con barra de progreso y log detallado

### 2. **Entidades Sincronizadas**
- ✅ **Ventas** - Historial de ventas por sucursal
- ✅ **Clientes** - Catálogo completo de clientes
- ✅ **Productos** - Catálogo de productos
- ✅ **Precios** - Precios por cliente y producto
- ✅ **Inventario** - Existencias por sucursal
- ✅ **Cartera** - Saldos de clientes
- ✅ **Usuarios** - Usuarios del sistema

### 3. **Pantalla de Visualización**
- Tabs para cada entidad sincronizada
- Contador de registros en cada tab
- Búsqueda y filtrado por entidad
- Pull-to-refresh para recargar datos
- Diseño tipo tarjetas (cards) con información relevante

## 🏗️ Arquitectura

### Archivos Creados

#### 1. `services/RealmSchemas.ts`
Define los esquemas de Realm para todas las entidades:
```typescript
- VentaSchema
- UsuarioSchema
- ProductoSchema
- PrecioSchema
- InventarioSchema
- CarteraSchema
- ClienteFullSchema
- SyncStatusSchema
```

#### 2. `services/FullSyncService.ts`
Servicio principal de sincronización:
- `syncAll()` - Sincroniza todas las entidades con callback de progreso
- `getVentas()`, `getProductos()`, etc. - Métodos para consultar datos
- `getStats()` - Obtiene estadísticas de registros sincronizados
- `initialize()` - Inicializa la base de datos Realm

#### 3. `components/SyncProgressModal.tsx`
Modal visual que muestra:
- Progreso general (X de Y completados)
- Barra de progreso visual
- Log detallado por entidad
- Indicadores de estado (completado, error, sincronizando)

#### 4. `components/DataViewScreen.tsx`
Pantalla de visualización con:
- Tabs horizontales para cada entidad
- Lista de registros con scroll infinito
- Pull-to-refresh
- Vista de tarjetas personalizada por tipo de dato

## 🔄 Flujo de Sincronización

1. Usuario ingresa credenciales en LoginScreen
2. Se valida el login con AuthService
3. Si el login es exitoso:
   - Se muestra el modal de sincronización
   - Se ejecuta `FullSyncService.syncAll()`
   - Se sincronizan 7 entidades en orden:
     1. Usuarios
     2. Productos
     3. Precios
     4. Clientes
     5. Inventario
     6. Cartera
     7. Ventas
4. Cada sincronización reporta progreso al modal
5. Al completar, se cierra el modal y se navega al Home

## 📡 Endpoints Utilizados

```
Base URL: https://cbinfo.no-ip.info:9011

GET /api/MovilesVentas/ventas-full/{sucursal}
GET /api/MovilesVentas/usuarios-full
GET /api/MovilesVentas/productos-full
GET /api/MovilesVentas/precios-full
GET /api/MovilesVentas/inventario-erp-movil/{sucursal}?fechaMovto={fecha}
GET /api/MovilesVentas/cartera-full
GET /api/MovilesVentas/clientes-full
```

## 💾 Estructura de Datos en Realm

### Base de Datos
- **Path**: `FullSyncDB`
- **Schema Version**: 1

### Esquemas Principales

#### Venta
```typescript
{
  id: int (PK)
  sucursal: int
  noVenta: int
  nombreProducto: string
  nombreCliente: string
  importe: float
  fecha: date
  // ... más campos
}
```

#### Cliente
```typescript
{
  id: int (PK)
  nombre: string
  longitud: float
  latitud: float
  idGrupo: int
  credito: bool
  facturacionMovil: bool
  // ... más campos
}
```

#### Producto
```typescript
{
  id: int (PK)
  claveProd: string
  descripcion: string
  esKit: bool
  fechaAct: date
}
```

*Ver `RealmSchemas.ts` para esquemas completos*

## 🎨 UI/UX

### Modal de Sincronización
- Fondo semi-transparente
- Contenedor blanco centrado
- Barra de progreso animada
- Log scrolleable de actividades
- Indicadores de color:
  - 🟢 Verde: Completado
  - 🟠 Naranja: Sincronizando
  - 🔴 Rojo: Error

### Pantalla de Visualización
- Tabs horizontales con scroll
- Badges con conteo de registros
- Tarjetas con información estructurada
- Colores personalizados por tipo
- Empty state cuando no hay datos

## 🚀 Uso

### Para el Usuario Final

1. **Login**:
   - Ingresar credenciales
   - La sincronización se ejecuta automáticamente
   - Esperar a que complete (aprox. 10-30 segundos)

2. **Ver Datos Sincronizados**:
   - Desde el menú principal, seleccionar "Datos Sincronizados"
   - Elegir la entidad a visualizar en los tabs
   - Hacer scroll para ver más registros
   - Pull down para refrescar

### Para Desarrolladores

#### Usar el Servicio de Sincronización
```typescript
import FullSyncService from './services/FullSyncService';

// Sincronizar todas las entidades
await FullSyncService.syncAll(sucursalId, (progress) => {
  console.log(`${progress.current} de ${progress.total} - ${progress.entity}`);
});

// Consultar datos
const ventas = FullSyncService.getVentas(50);
const clientes = FullSyncService.getClientesFull(100);

// Obtener estadísticas
const stats = FullSyncService.getStats();
console.log(stats); // { ventas: 100, clientes: 50, ... }
```

#### Agregar Nueva Entidad

1. **Crear esquema en `RealmSchemas.ts`**:
```typescript
export const MiEntidadSchema = {
  name: 'MiEntidad',
  properties: {
    id: 'int',
    nombre: 'string',
    // ... más campos
  },
  primaryKey: 'id'
};
```

2. **Agregar al array ALL_SCHEMAS**:
```typescript
export const ALL_SCHEMAS = [
  // ... esquemas existentes
  MiEntidadSchema
];
```

3. **Agregar método de sincronización en `FullSyncService.ts`**:
```typescript
private async syncMiEntidad(): Promise<{ success: boolean; error?: string; count?: number }> {
  // Implementar lógica de sincronización
}
```

4. **Agregar al método syncAll**:
```typescript
const syncTasks = [
  // ... tareas existentes
  { name: 'MiEntidad', fn: () => this.syncMiEntidad() },
];
```

5. **Agregar a DataViewScreen** para visualización

## 🔧 Configuración

### Cambiar Sucursal de Sincronización
En `LoginScreen.tsx`, línea 49:
```typescript
await FullSyncService.syncAll(1, ...); // Cambiar el 1 por el ID de sucursal
```

### Cambiar Límite de Registros
En `FullSyncService.ts`, los métodos get:
```typescript
getVentas(limit: number = 100) // Cambiar default de 100
```

### Personalizar Tiempo de Espera Post-Sincronización
En `LoginScreen.tsx`, línea 54:
```typescript
await new Promise<void>(resolve => setTimeout(() => resolve(), 1500)); // Cambiar 1500ms
```

## 📊 Estadísticas

El servicio mantiene estadísticas en tiempo real:
- Total de registros por entidad
- Fecha de última sincronización
- Estado de sincronización (completed/failed)

Acceder con:
```typescript
const stats = FullSyncService.getStats();
const status = FullSyncService.getSyncStatus('all');
```

## ⚠️ Notas Importantes

1. **Conexión Requerida**: La sincronización requiere conexión a internet
2. **Tiempo de Sincronización**: Varía según cantidad de datos (10-60 segundos típicamente)
3. **Almacenamiento**: Los datos se almacenan localmente en el dispositivo
4. **Actualización**: Los datos se actualizan en cada login
5. **Limpieza**: Algunas entidades limpian datos antiguos antes de sincronizar (Ventas, Inventario)

## 🐛 Troubleshooting

### Error: "No se pudieron cargar los datos"
- Verificar conexión a internet
- Revisar que el servidor esté disponible
- Verificar logs en consola

### Datos no se muestran
- Hacer pull-to-refresh en DataViewScreen
- Verificar que la sincronización completó exitosamente
- Revisar logs de Realm

### Sincronización lenta
- Revisar conexión de red
- Verificar cantidad de datos a sincronizar
- Considerar limitar registros por endpoint

## 📝 Changelog

### Versión 1.0.0 (2025-11-12)
- ✅ Implementación inicial de sistema de sincronización
- ✅ 7 entidades sincronizadas
- ✅ Modal de progreso visual
- ✅ Pantalla de visualización de datos
- ✅ Integración con LoginScreen

## 👥 Contribuciones

Para agregar nuevas funcionalidades:
1. Seguir la estructura existente en `FullSyncService.ts`
2. Mantener consistencia en esquemas de Realm
3. Actualizar esta documentación
4. Probar sincronización completa antes de commit

## 📄 Licencia

Proyecto interno - Todos los derechos reservados
