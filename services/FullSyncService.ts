import Realm, { UpdateMode } from 'realm';
import { ALL_SCHEMAS } from './RealmSchemas';

export interface SyncProgress {
  current: number;
  total: number;
  entity: string;
  status: 'syncing' | 'completed' | 'error';
  message?: string;
}

export type SyncProgressCallback = (progress: SyncProgress) => void;

class FullSyncService {
  private realm: Realm | null = null;
  private isInitialized = false;
  private apiBaseUrl = 'https://cbinfo.no-ip.info:9011';

  async initialize(): Promise<void> {
    if (this.isInitialized && this.realm && !this.realm.isClosed) {
      return;
    }

    try {
      this.realm = await Realm.open({
        path: 'FullSyncDB',
        schema: ALL_SCHEMAS,
        schemaVersion: 3,
        onMigration: (oldRealm: Realm, newRealm: Realm) => {
          const newCartera = newRealm.objects('Cartera');
          for (let i = 0; i < newCartera.length; i++) {
            const obj: any = newCartera[i];
            if (typeof obj.cobrado === 'undefined') {
              obj.cobrado = false;
            }
          }
        },
      });

      this.isInitialized = true;
      console.log('✅ FullSyncService inicializado correctamente');
    } catch (error) {
      console.error('❌ Error al inicializar FullSyncService:', error);
      throw error;
    }
  }

  async syncAll(
    sucursal: number = 1,
    onProgress?: SyncProgressCallback,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const syncTasks = [
      { name: 'Usuarios', fn: () => this.syncUsuarios() },
      { name: 'Productos', fn: () => this.syncProductos() },
      { name: 'Precios', fn: () => this.syncPrecios() },
      { name: 'Clientes', fn: () => this.syncClientesFull() },
      { name: 'Inventario', fn: () => this.syncInventario(sucursal) },
      { name: 'Cartera', fn: () => this.syncCartera() },
      { name: 'Ventas', fn: () => this.syncVentas(sucursal) },
    ];

    const total = syncTasks.length;
    let current = 0;

    try {
      for (const task of syncTasks) {
        current++;

        if (onProgress) {
          onProgress({
            current,
            total,
            entity: task.name,
            status: 'syncing',
            message: `Sincronizando ${task.name}...`,
          });
        }

        const result = await task.fn();

        if (!result.success) {
          if (onProgress) {
            onProgress({
              current,
              total,
              entity: task.name,
              status: 'error',
              message: result.error || 'Error desconocido',
            });
          }
          console.warn(`⚠️ Error al sincronizar ${task.name}:`, result.error);
        } else {
          if (onProgress) {
            onProgress({
              current,
              total,
              entity: task.name,
              status: 'completed',
              message: `${task.name} sincronizado (${
                result.count || 0
              } registros)`,
            });
          }
        }
      }

      // Actualizar estado de sincronización
      this.updateSyncStatus('all', true);

      if (onProgress) {
        onProgress({
          current: total,
          total,
          entity: 'Completado',
          status: 'completed',
          message: '✅ Sincronización completa exitosa',
        });
      }

      return { success: true };
    } catch (error: any) {
      console.error('❌ Error durante la sincronización completa:', error);

      if (onProgress) {
        onProgress({
          current,
          total,
          entity: 'Error',
          status: 'error',
          message: error?.message || 'Error durante la sincronización',
        });
      }

      return { success: false, error: error?.message };
    }
  }

  private async syncVentas(
    sucursal: number,
  ): Promise<{ success: boolean; error?: string; count?: number }> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/MovilesVentas/ventas-full/${sucursal}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor');
      }

      const localIdThreshold = Date.now();

      this.realm!.write(() => {
        // Limpiar ventas anteriores de esta sucursal (solo ids "normales")
        const existingVentas = this.realm!.objects('Venta').filtered(
          'sucursal == $0 AND id <= $1',
          sucursal,
          localIdThreshold,
        );
        this.realm!.delete(existingVentas);

        // Insertar nuevas ventas
        data.forEach((venta: any) => {
          this.realm!.create('Venta', {
            id: venta.id,
            sucursal: venta.sucursal,
            noVenta: venta.noVenta,
            claveProd: venta.claveProd,
            nombreProducto: venta.nombreProducto,
            cantProducto: venta.cantProducto,
            precio: venta.precio,
            importe: venta.importe,
            cveCliente: venta.cveCliente,
            nombreCliente: venta.nombreCliente,
            fecha: venta.fecha ? new Date(venta.fecha) : null,
            tipoPago: venta.tipoPago,
            descripcionMedioPago: venta.descripcionMedioPago,
            vendedor: venta.vendedor,
            folioFactura: venta.folioFactura ?? false,
            facturacionMovil: venta.facturacionMovil ?? false,
            syncedAt: new Date(),
          });
        });
      });

      console.log(`✅ Ventas sincronizadas: ${data.length} registros`);
      return { success: true, count: data.length };
    } catch (error: any) {
      console.error('❌ Error al sincronizar ventas:', error);
      return { success: false, error: error?.message };
    }
  }

  private async syncUsuarios(): Promise<{
    success: boolean;
    error?: string;
    count?: number;
  }> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/MovilesVentas/usuarios-full`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor');
      }

      this.realm!.write(() => {
        data.forEach((usuario: any) => {
          this.realm!.create(
            'Usuario',
            {
              id: usuario.id,
              nombre: usuario.nombre,
              perfil: usuario.perfil,
              descripcionPerfil: usuario.descripcionPerfil,
              puesto: usuario.puesto,
              descripcionPuesto: usuario.descripcionPuesto,
              claveEmpleado: usuario.claveEmpleado,
              password: usuario.password,
              sucursalOrigen: usuario.sucursalOrigen,
              syncedAt: new Date(),
            },
            UpdateMode.Modified,
          );
        });
      });

      console.log(`✅ Usuarios sincronizados: ${data.length} registros`);
      return { success: true, count: data.length };
    } catch (error: any) {
      console.error('❌ Error al sincronizar usuarios:', error);
      return { success: false, error: error?.message };
    }
  }

  private async syncProductos(): Promise<{
    success: boolean;
    error?: string;
    count?: number;
  }> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/MovilesVentas/productos-full`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor');
      }

      this.realm!.write(() => {
        data.forEach((producto: any) => {
          this.realm!.create(
            'Producto',
            {
              id: producto.id,
              claveProd: producto.claveProd,
              descripcion: producto.descripcion,
              esKit: producto.esKit ?? false,
              fechaAct: producto.fechaAct ? new Date(producto.fechaAct) : null,
              syncedAt: new Date(),
            },
            UpdateMode.Modified,
          );
        });
      });

      console.log(`✅ Productos sincronizados: ${data.length} registros`);
      return { success: true, count: data.length };
    } catch (error: any) {
      console.error('❌ Error al sincronizar productos:', error);
      return { success: false, error: error?.message };
    }
  }

  private async syncPrecios(): Promise<{
    success: boolean;
    error?: string;
    count?: number;
  }> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/MovilesVentas/precios-full`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor');
      }

      this.realm!.write(() => {
        data.forEach((precio: any) => {
          this.realm!.create(
            'Precio',
            {
              id: String(precio.id),
              descripcion: precio.descripcion,
              idCliente: precio.idCliente,
              claveProd: precio.claveProd,
              precio: precio.precio,
              fechaAct: precio.fechaAct ? new Date(precio.fechaAct) : null,
              syncedAt: new Date(),
            },
            UpdateMode.Modified,
          );
        });
      });

      console.log(`✅ Precios sincronizados: ${data.length} registros`);
      return { success: true, count: data.length };
    } catch (error: any) {
      console.error('❌ Error al sincronizar precios:', error);
      return { success: false, error: error?.message };
    }
  }

  private async syncInventario(
    sucursal: number,
    fechaMovto?: string,
  ): Promise<{ success: boolean; error?: string; count?: number }> {
    try {
      // Si no se proporciona fecha, usar fecha LOCAL (YYYY-MM-DD) del dispositivo
      const effectiveFechaMovto =
        fechaMovto ??
        (() => {
          const now = new Date();
          const yyyy = now.getFullYear();
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const dd = String(now.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        })();

      const response = await fetch(
        `${this.apiBaseUrl}/api/MovilesVentas/inventario-erp-movil/${sucursal}?fechaMovto=${effectiveFechaMovto}`,
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      console.log(data);
      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor');
      }

      const localIdThreshold = Date.now();
      const unsyncedSentinel = new Date(0);

      this.realm!.write(() => {
        // Limpiar inventario anterior de TODAS las sucursales.
        // Se borran:
        // - Todos los registros con id "normal" (<= Date.now()).
        // - Cualquier registro ya sincronizado (syncedAt != fecha centinela),
        //   incluso si su id es mayor a Date.now().
        // Se conservan únicamente los movimientos locales no sincronizados
        // (id > Date.now() y syncedAt == new Date(0)).
        const existingInventario = this.realm!.objects('Inventario').filtered(
          'id <= $0 OR syncedAt != $1',
          localIdThreshold,
          unsyncedSentinel,
        );
        this.realm!.delete(existingInventario);

        // Insertar nuevo inventario
        data.forEach((inventario: any) => {
          this.realm!.create('Inventario', {
            id: inventario.id,
            sucursal: inventario.sucursal,
            claveProd: inventario.claveProd,
            fechaArrastre: inventario.fechaArrastre
              ? new Date(inventario.fechaArrastre)
              : null,
            saldo: inventario.saldo,
            descripcion: inventario.descripcion ?? null,
            syncedAt: new Date(),
          });
        });
      });

      console.log(`✅ Inventario sincronizado: ${data.length} registros`);
      return { success: true, count: data.length };
    } catch (error: any) {
      console.error('❌ Error al sincronizar inventario:', error);
      return { success: false, error: error?.message };
    }
  }

  private async syncCartera(): Promise<{
    success: boolean;
    error?: string;
    count?: number;
  }> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/MovilesVentas/cartera-full`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor');
      }

      this.realm!.write(() => {
        data.forEach((cartera: any) => {
          this.realm!.create(
            'Cartera',
            {
              id: cartera.id,
              idCliente: cartera.idCliente,
              nombreCliente: cartera.nombreCliente,
              sucursal: cartera.sucursal,
              sucursalSegmento: cartera.sucursalSegmento,
              saldo: cartera.saldo,
              fecha: cartera.fecha ? new Date(cartera.fecha) : null,
              idSegmento: cartera.idSegmento,
              noVenta: cartera.noVenta,
              syncedAt: new Date(),
            },
            UpdateMode.Modified,
          );
        });
      });

      console.log(`✅ Cartera sincronizada: ${data.length} registros`);
      return { success: true, count: data.length };
    } catch (error: any) {
      console.error('❌ Error al sincronizar cartera:', error);
      return { success: false, error: error?.message };
    }
  }

  private async syncClientesFull(): Promise<{
    success: boolean;
    error?: string;
    count?: number;
  }> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/MovilesVentas/clientes-full`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor');
      }

      this.realm!.write(() => {
        data.forEach((cliente: any) => {
          this.realm!.create(
            'ClienteFull',
            {
              id: cliente.id,
              nombre: cliente.nombre,
              longitud: cliente.longitud ?? 0,
              latitud: cliente.latitud ?? 0,
              idGrupo: cliente.idGrupo,
              credito: cliente.credito ?? false,
              facturacionMovil: cliente.facturacionMovil ?? false,
              fechaAct: cliente.fechaAct ? new Date(cliente.fechaAct) : null,
              syncedAt: new Date(),
            },
            UpdateMode.Modified,
          );
        });
      });

      console.log(`✅ Clientes sincronizados: ${data.length} registros`);
      return { success: true, count: data.length };
    } catch (error: any) {
      console.error('❌ Error al sincronizar clientes:', error);
      return { success: false, error: error?.message };
    }
  }

  private updateSyncStatus(entity: string, success: boolean): void {
    if (!this.realm) return;

    this.realm.write(() => {
      this.realm!.create(
        'SyncStatus',
        {
          id: entity,
          lastSyncDate: new Date(),
          status: success ? 'completed' : 'failed',
        },
        UpdateMode.Modified,
      );
    });
  }

  async getSucursales(): Promise<{ id: number; nombre: string }[]> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/MovilesVentas/sucursales`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor');
      }

      return data.map((item: any) => ({
        id: Number(item.id),
        nombre: String(item.nombre),
      }));
    } catch (error: any) {
      console.error('❌ Error al obtener sucursales:', error);
      throw error;
    }
  }

  // Métodos para consultar datos
  getVentas(limit: number = 100): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(
      this.realm.objects('Venta').sorted('fecha', true).slice(0, limit),
    );
  }

  getVentasPaginated(offset: number = 0, limit: number = 50): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(
      this.realm
        .objects('Venta')
        .sorted('fecha', true)
        .slice(offset, offset + limit),
    );
  }

  /**
   * Crea ventas locales en Realm (una fila por producto de la venta).
   * Se usa para registrar ventas hechas en el punto de venta antes de sincronizar.
   */
  async createLocalVentas(
    ventas: {
      id: number;
      sucursal?: number | null;
      noVenta?: number | null;
      claveProd?: number | null;
      nombreProducto?: string | null;
      cantProducto?: number | null;
      precio?: number | null;
      importe?: number | null;
      cveCliente?: number | null;
      nombreCliente?: string | null;
      fecha?: Date | null;
      tipoPago?: number | null;
      descripcionMedioPago?: string | null;
      vendedor?: string | null;
      folioFactura?: boolean | null;
      facturacionMovil?: boolean | null;
    }[],
  ): Promise<void> {
    if (!ventas.length) return;

    if (!this.isInitialized || !this.realm) {
      await this.initialize();
    }
    if (!this.realm) return;

    this.realm.write(() => {
      ventas.forEach(v => {
        this.realm!.create('Venta', {
          id: v.id,
          sucursal: v.sucursal ?? null,
          noVenta: v.noVenta ?? null,
          claveProd: v.claveProd ?? null,
          nombreProducto: v.nombreProducto ?? null,
          cantProducto: v.cantProducto ?? null,
          precio: v.precio ?? null,
          importe: v.importe ?? null,
          cveCliente: v.cveCliente ?? null,
          nombreCliente: v.nombreCliente ?? null,
          fecha: v.fecha ?? new Date(),
          tipoPago: v.tipoPago ?? null,
          descripcionMedioPago: v.descripcionMedioPago ?? null,
          vendedor: v.vendedor ?? null,
          folioFactura: v.folioFactura ?? false,
          facturacionMovil: v.facturacionMovil ?? false,
          // Fecha centinela para indicar que aún no se sincroniza
          syncedAt: new Date(0),
        });
      });
    });
  }

  /**
   * Crea movimientos locales en Inventario (por ejemplo, recepción de traspasos).
   */
  async createLocalInventarioMovements(
    movimientos: {
      id: number;
      sucursal?: number | null;
      claveProd?: number | null;
      saldo: number;
      fechaArrastre?: Date | null;
      descripcion?: string | null;
    }[],
  ): Promise<void> {
    if (!movimientos.length) return;

    if (!this.isInitialized || !this.realm) {
      await this.initialize();
    }
    if (!this.realm) return;

    this.realm.write(() => {
      movimientos.forEach(m => {
        const idValue = Number(m.id);
        const sucursalValue =
          m.sucursal === null || m.sucursal === undefined
            ? null
            : Number(m.sucursal);
        const claveProdValue =
          m.claveProd === null || m.claveProd === undefined
            ? null
            : Number(m.claveProd);

        this.realm!.create('Inventario', {
          id: idValue,
          sucursal: sucursalValue,
          claveProd: claveProdValue,
          fechaArrastre: m.fechaArrastre ?? new Date(),
          saldo: m.saldo,
          descripcion: m.descripcion ?? null,
          // Fecha centinela para indicar que aún no se sincroniza
          syncedAt: new Date(0),
        });
      });
    });
  }

  /**
   * Crea movimientos locales en Cartera (por ejemplo, pagos registrados en Cobranza).
   */
  async createLocalCarteraMovements(
    movimientos: {
      id: number;
      idCliente?: number | null;
      nombreCliente?: string | null;
      sucursal?: number | null;
      sucursalSegmento?: number | null;
      saldo: number;
      fecha?: Date | null;
      idSegmento?: number | null;
      noVenta?: number | null;
    }[],
  ): Promise<void> {
    if (!movimientos.length) return;

    if (!this.isInitialized || !this.realm) {
      await this.initialize();
    }
    if (!this.realm) return;

    this.realm.write(() => {
      movimientos.forEach(m => {
        this.realm!.create('Cartera', {
          id: m.id,
          idCliente: m.idCliente ?? null,
          nombreCliente: m.nombreCliente ?? null,
          sucursal: m.sucursal ?? null,
          sucursalSegmento: m.sucursalSegmento ?? null,
          saldo: m.saldo,
          fecha: m.fecha ?? new Date(),
          idSegmento: m.idSegmento ?? null,
          noVenta: m.noVenta ?? null,
          // Fecha centinela para indicar que aún no se sincroniza
          syncedAt: new Date(0),
        });
      });
    });
  }

  async markCarteraAsPaid(ids: number[]): Promise<void> {
    if (!ids.length) return;

    if (!this.isInitialized || !this.realm) {
      await this.initialize();
    }
    if (!this.realm) return;

    this.realm.write(() => {
      ids.forEach(id => {
        const row: any = this.realm!.objectForPrimaryKey('Cartera', id);
        if (row) {
          row.cobrado = true;
        }
      });
    });
  }

  getUsuarios(limit: number = 100): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(
      this.realm.objects('Usuario').sorted('nombre').slice(0, limit),
    );
  }

  getUsuariosPaginated(offset: number = 0, limit: number = 50): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(
      this.realm
        .objects('Usuario')
        .sorted('nombre')
        .slice(offset, offset + limit),
    );
  }

  getProductos(limit: number = 100): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(
      this.realm.objects('Producto').sorted('descripcion').slice(0, limit),
    );
  }

  getProductosPaginated(offset: number = 0, limit: number = 50): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(
      this.realm
        .objects('Producto')
        .sorted('descripcion')
        .slice(offset, offset + limit),
    );
  }

  getPrecios(limit: number = 100): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(
      this.realm.objects('Precio').sorted('descripcion').slice(0, limit),
    );
  }

  getPreciosPaginated(offset: number = 0, limit: number = 50): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(
      this.realm
        .objects('Precio')
        .sorted('descripcion')
        .slice(offset, offset + limit),
    );
  }

  getInventario(limit: number = 100): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(this.realm.objects('Inventario').slice(0, limit));
  }

  getInventarioPaginated(offset: number = 0, limit: number = 50): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(
      this.realm.objects('Inventario').slice(offset, offset + limit),
    );
  }

  getCartera(limit: number = 100): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(
      this.realm.objects('Cartera').sorted('nombreCliente').slice(0, limit),
    );
  }

  getCarteraPaginated(offset: number = 0, limit: number = 50): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(
      this.realm
        .objects('Cartera')
        .sorted('nombreCliente')
        .slice(offset, offset + limit),
    );
  }

  getVentasTotalEfectivoForDate(date: Date): number {
    if (!this.isInitialized || !this.realm) return 0;

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    console.log(
      Array.from(this.realm.objects('Venta').filtered('id > 1700000000')),
    );
    const ventas = this.realm
      .objects('Venta')
      .filtered('fecha >= $0 AND fecha <= $1 AND tipoPago == 1', start, end);

    let total = 0;
    for (let i = 0; i < ventas.length; i++) {
      const v: any = ventas[i];
      total += v.importe || 0;
    }
    return total;
  }
  // {
  //     "id": 1763078957601044,
  //     "sucursal": 44,
  //     "noVenta": 1763078957601044,
  //     "claveProd": 2,
  //     "nombreProducto": "Bolsa 5Kg",
  //     "cantProducto": 1,
  //     "precio": 25,
  //     "importe": 25,
  //     "cveCliente": 942,
  //     "nombreCliente": "001 ABARROTES FASTI SAN JOSE",
  //     "fecha": "2025-11-14T00:09:17.601Z",
  //     "tipoPago": 1,
  //     "descripcionMedioPago": "Efectivo",
  //     "vendedor": "CBERP14",
  //     "folioFactura": false,
  //     "facturacionMovil": false,
  //     "syncedAt": "1970-01-01T00:00:00.000Z"
  // }
  getClientesFull(limit: number = 100): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(
      this.realm.objects('ClienteFull').sorted('nombre').slice(0, limit),
    );
  }

  getClientesFullPaginated(offset: number = 0, limit: number = 50): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(
      this.realm
        .objects('ClienteFull')
        .sorted('nombre')
        .slice(offset, offset + limit),
    );
  }

  getClienteFullById(idCliente: number): any | null {
    if (!this.isInitialized || !this.realm) return null;
    const obj = this.realm.objectForPrimaryKey('ClienteFull', idCliente);
    return obj || null;
  }

  getPreciosByCliente(idCliente: number): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(
      this.realm.objects('Precio').filtered('idCliente == $0', idCliente),
    );
  }

  getSyncStatus(entity: string = 'all'): any {
    if (!this.isInitialized || !this.realm) return null;
    return this.realm.objectForPrimaryKey('SyncStatus', entity);
  }

  getStats(): any {
    if (!this.isInitialized || !this.realm) {
      return {
        ventas: 0,
        usuarios: 0,
        productos: 0,
        precios: 0,
        inventario: 0,
        cartera: 0,
        clientes: 0,
      };
    }

    return {
      ventas: this.realm.objects('Venta').length,
      usuarios: this.realm.objects('Usuario').length,
      productos: this.realm.objects('Producto').length,
      precios: this.realm.objects('Precio').length,
      inventario: this.realm.objects('Inventario').length,
      cartera: this.realm.objects('Cartera').length,
      clientes: this.realm.objects('ClienteFull').length,
    };
  }

  close(): void {
    if (this.realm && !this.realm.isClosed) {
      this.realm.close();
      this.isInitialized = false;
      console.log('🔒 FullSyncService cerrado');
    }
  }
}

export default new FullSyncService();
