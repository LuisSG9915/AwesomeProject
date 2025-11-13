# 🔗 Integración de Ventas con Realm Database

## 📅 Fecha: 12 de Noviembre, 2025

## 🎯 Objetivo

Conectar la pantalla **ReporteVentasScreen** con la base de datos local Realm para consultar ventas sincronizadas sin necesidad de conexión a internet.

## ✅ Características Implementadas

### 1. **Consulta de Ventas desde Realm**
- ✅ Carga automática de ventas al abrir la pantalla
- ✅ Filtrado por rango de fechas
- ✅ Visualización de información detallada
- ✅ Soporte para múltiples tipos de pago

### 2. **Interfaz Mejorada**
- ✅ Botón de recarga (🔄) para actualizar datos desde Realm
- ✅ Indicador de cantidad de ventas sincronizadas
- ✅ Alert visual cuando no hay datos
- ✅ Cards informativos con colores distintivos

### 3. **Funcionalidades Mantenidas**
- ✅ Impresión de tickets
- ✅ Visualización de tickets
- ✅ Facturación (simulada)
- ✅ Cálculo de totales por tipo de pago
- ✅ Información de productos en tickets

## 🔄 Flujo de Funcionamiento

### Al Abrir la Pantalla
1. Se ejecuta `useEffect` automáticamente
2. Inicializa FullSyncService
3. Carga hasta 500 ventas de Realm
4. Muestra indicador con cantidad de ventas disponibles

### Al Consultar Ventas
1. Usuario ingresa rango de fechas (formato DD/MM/YYYY)
2. Click en botón "Consultar"
3. Sistema filtra ventas locales por fechas
4. Mapea datos de Realm a formato de presentación
5. Muestra resultados con totales calculados

### Botón de Recarga
- Click en 🔄 recarga datos desde Realm
- Útil después de sincronizar manualmente

## 📊 Mapeo de Datos

### Desde Realm (VentaSchema)
```typescript
{
  id: number
  sucursal: number
  noVenta: number
  claveProd: number
  nombreProducto: string
  cantProducto: number
  precio: float
  importe: float
  cveCliente: number
  nombreCliente: string
  fecha: date
  tipoPago: number  // 1=Efectivo, 2=Crédito, 3=Transferencia
  descripcionMedioPago: string
  vendedor: string
  folioFactura: bool
  facturacionMovil: bool
}
```

### Hacia ReporteItem (UI)
```typescript
{
  id: number
  no_venta: number
  fecha: string (ISO)
  nombre: string
  importe: number
  tipoPago: 'Efectivo' | 'Credito' | 'Transferencia'
  facturacion: boolean
  timbrado: '0' | '1'
  sucursal: number
  cve_cliente: number
  nombreProducto: string
  cantProducto: number
  precio: number
}
```

## 🎨 Elementos de UI Agregados

### 1. Header con Título y Recarga
```tsx
<View style={styles.titleRow}>
  <Text style={styles.title}>Consulta a Ventas</Text>
  <TouchableOpacity style={styles.refreshButton} onPress={loadVentas}>
    <Text style={styles.refreshIcon}>🔄</Text>
  </TouchableOpacity>
</View>
```

### 2. Card Informativo (Datos Disponibles)
```tsx
<View style={styles.infoCard}>
  <Text style={styles.infoText}>
    📊 {allVentas.length} ventas sincronizadas en la base local
  </Text>
</View>
```

### 3. Card de Advertencia (Sin Datos)
```tsx
<View style={styles.warningCard}>
  <Text style={styles.warningIcon}>⚠️</Text>
  <Text style={styles.warningText}>
    No hay ventas sincronizadas...
  </Text>
</View>
```

## 🔧 Funciones Principales

### `loadVentas()`
Carga ventas desde Realm al estado del componente.
```typescript
const loadVentas = async () => {
  await FullSyncService.initialize();
  const ventas = FullSyncService.getVentas(500);
  setAllVentas(ventas);
};
```

### `parseFecha(dateStr)`
Convierte string DD/MM/YYYY a objeto Date.
```typescript
const parseFecha = (dateStr: string): Date | null => {
  const parts = dateStr.split('/');
  // Validación y conversión
  return new Date(year, month, day);
};
```

### `mapTipoPago(tipo)`
Convierte código numérico a string descriptivo.
```typescript
const mapTipoPago = (tipo: number): string => {
  if (tipo === 1) return 'Efectivo';
  if (tipo === 2) return 'Credito';
  if (tipo === 3) return 'Transferencia';
};
```

### `consultar()`
Filtra y mapea ventas según rango de fechas.
```typescript
const consultar = () => {
  // Parse fechas
  // Filtrar por rango
  // Mapear a formato UI
  // Actualizar estado
};
```

## 📱 Experiencia de Usuario

### Escenario 1: Con Datos Sincronizados
```
┌─────────────────────────────────────────┐
│ Consulta a Ventas              [🔄]     │
├─────────────────────────────────────────┤
│ 📊 250 ventas sincronizadas            │
├─────────────────────────────────────────┤
│ Fecha inicial: [12/11/2025]            │
│ Fecha final:   [12/11/2025]            │
│             [Consultar]                 │
├─────────────────────────────────────────┤
│ Resultados:                             │
│ #3143 • CAFE DON JUSTO                 │
│ 24/10/2025 • Efectivo     $9,520.00   │
│ [Imprimir] [Visualizar] [Facturar]     │
└─────────────────────────────────────────┘
```

### Escenario 2: Sin Datos Sincronizados
```
┌─────────────────────────────────────────┐
│ Consulta a Ventas              [🔄]     │
├─────────────────────────────────────────┤
│ ⚠️ No hay ventas sincronizadas.       │
│    Inicia sesión nuevamente o          │
│    sincroniza desde el menú principal. │
└─────────────────────────────────────────┘
```

## 🎫 Ticket Mejorado

### Antes
```
================================
            TICKET
================================
VENTA: 3143
FECHA: 24/10/2025 14:44:50
CLIENTE: CAFE DON JUSTO
PAGO: Efectivo
--------------------------------
TOTAL: $9520.00
================================
```

### Después
```
================================
            TICKET
================================
VENTA: 3143
FECHA: 24/10/2025 14:44:50
CLIENTE: CAFE DON JUSTO
--------------------------------
PRODUCTO: Bolsa 5Kg
CANTIDAD: 340
PRECIO UNIT: $28.00
--------------------------------
PAGO: Efectivo
TOTAL: $9520.00
================================
```

## 🎨 Estilos Agregados

### Header Row
```typescript
titleRow: { 
  flexDirection: 'row', 
  justifyContent: 'space-between', 
  alignItems: 'center', 
  marginBottom: 12 
}
```

### Refresh Button
```typescript
refreshButton: {
  backgroundColor: '#1976D2',
  borderRadius: 10,
  padding: 10,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.15,
  shadowRadius: 3,
  elevation: 3,
}
```

### Info Card (Azul)
```typescript
infoCard: {
  backgroundColor: '#E3F2FD',
  borderRadius: 10,
  padding: 12,
  marginBottom: 12,
  borderLeftWidth: 4,
  borderLeftColor: '#1976D2',
}
```

### Warning Card (Naranja)
```typescript
warningCard: {
  backgroundColor: '#FFF3E0',
  borderRadius: 10,
  padding: 16,
  marginBottom: 12,
  borderLeftWidth: 4,
  borderLeftColor: '#FF9800',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
}
```

## 📋 Validaciones Implementadas

### 1. Formato de Fecha
- Valida formato DD/MM/YYYY
- Muestra alert si formato es inválido
- Evita crashes por fechas mal formadas

### 2. Datos Nulos
- Maneja fechas nulas o undefined
- Valores por defecto para campos opcionales
- Evita errores de renderizado

### 3. Rango de Fechas
- Ajusta fecha final al final del día (23:59:59)
- Incluye ambas fechas límite en resultados
- Filtra correctamente por timestamp

## 🔍 Casos de Uso

### 1. Consultar Ventas del Día
```
Fecha inicial: 12/11/2025
Fecha final:   12/11/2025
[Consultar]
```

### 2. Consultar Ventas del Mes
```
Fecha inicial: 01/11/2025
Fecha final:   30/11/2025
[Consultar]
```

### 3. Recargar Después de Sincronizar
```
1. Usuario sincroniza desde Home
2. Regresa a Reporte de Ventas
3. Click en 🔄
4. Datos actualizados
```

## ⚙️ Configuración

### Límite de Ventas
Por defecto carga 500 ventas. Para cambiar:
```typescript
const ventas = FullSyncService.getVentas(500); // Cambiar 500
```

### Formato de Fecha
Actualmente DD/MM/YYYY. Para cambiar, modificar:
- `parseFecha()` función
- Placeholders en inputs
- Formato inicial en `today`

## 🐛 Manejo de Errores

### Error al Cargar
```typescript
catch (error) {
  console.error('Error al cargar ventas:', error);
  Alert.alert('Error', 'No se pudieron cargar las ventas...');
}
```

### Error al Filtrar
```typescript
catch (error) {
  console.error('Error al filtrar ventas:', error);
  Alert.alert('Error', 'Ocurrió un error al consultar...');
}
```

## 📈 Cálculos de Totales

### Total General
```typescript
const total = useMemo(
  () => items.reduce((s, i) => s + i.importe, 0), 
  [items]
);
```

### Total Efectivo
```typescript
const totalEfectivo = useMemo(
  () => items.filter(i => i.tipoPago === 'Efectivo')
              .reduce((s, i) => s + i.importe, 0),
  [items]
);
```

### Total Crédito
```typescript
const totalCredito = useMemo(
  () => items.filter(i => i.tipoPago === 'Credito')
              .reduce((s, i) => s + i.importe, 0),
  [items]
);
```

## ✨ Ventajas de Usar Realm

1. **Offline First** - Funciona sin conexión
2. **Rendimiento** - Consultas rápidas en local
3. **Sincronización** - Datos actualizados al login
4. **Capacidad** - Miles de registros sin lag
5. **Tipado** - Esquemas bien definidos

## 🔄 Sincronización con Servidor

La sincronización se realiza:
1. **Al Login** - Automática y completa
2. **Manual** - Desde botón en Home
3. **Datos** - Ventas de la sucursal del usuario

## 📝 Cambios en el Código

### Imports Agregados
```typescript
import { useEffect } from 'react';
import FullSyncService from '../services/FullSyncService';
```

### Estados Agregados
```typescript
const [allVentas, setAllVentas] = useState<any[]>([]);
```

### Funciones Modificadas
- ✅ `consultar()` - Ahora filtra datos de Realm
- ✅ `generateTicket()` - Incluye info del producto

### Funciones Nuevas
- ✅ `loadVentas()` - Carga desde Realm
- ✅ `parseFecha()` - Parse de fechas
- ✅ `mapTipoPago()` - Mapeo de tipos de pago

## 🎯 Próximas Mejoras Sugeridas

### Prioridad Alta
- [ ] Date picker visual para selección de fechas
- [ ] Exportar reporte a PDF
- [ ] Filtros adicionales (cliente, producto, vendedor)

### Prioridad Media
- [ ] Gráficas de ventas
- [ ] Comparativas por período
- [ ] Búsqueda de ventas específicas

### Prioridad Baja
- [ ] Ordenamiento personalizado
- [ ] Favoritos/guardados
- [ ] Compartir reportes

## 📊 Métricas de Rendimiento

| Operación | Tiempo Estimado |
|-----------|-----------------|
| Cargar 500 ventas | < 100ms |
| Filtrar por fechas | < 50ms |
| Renderizar resultados | < 200ms |
| Generar ticket | < 10ms |

## ✅ Checklist de Testing

- [x] Cargar ventas al abrir pantalla
- [x] Mostrar indicador de cantidad
- [x] Filtrar por rango de fechas
- [x] Validar formato de fechas
- [x] Calcular totales correctamente
- [x] Generar tickets con productos
- [x] Recargar con botón 🔄
- [x] Manejar caso sin datos
- [x] Responsive en diferentes tamaños

---

**🎉 ReporteVentasScreen ahora está completamente integrado con Realm Database**
