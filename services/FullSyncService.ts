import Realm, { UpdateMode } from 'realm';
import { ALL_SCHEMAS, SyncLogSchema } from './RealmSchemas';
import { SyncOrchestrator } from './sync/SyncOrchestrator';
import { SyncProgress } from './sync/SyncTask';

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
        schemaVersion: 5, // Actualizado para incluir SyncTableLogSchema
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
      console.log(
        '✅ FullSyncService inicializado correctamente (v5 con SyncTableLog)',
      );
    } catch (error) {
      console.error('❌ Error al inicializar FullSyncService:', error);
      throw error;
    }
  }

  /**
   * Sincroniza todas las tablas usando la nueva arquitectura escalable
   * Maneja dependencias, prioridades y bitácora detallada por tabla
   */
  async syncAll(
    sucursal: number = 1,
    onProgress?: SyncProgressCallback,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.realm) {
      throw new Error('Realm no inicializado');
    }

    // Crear SyncLog principal
    const syncLogId = `${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const fechaInicio = new Date();

    try {
      // Guardar log inicial
      this.realm.write(() => {
        this.realm!.create('SyncLog', {
          id: syncLogId,
          fechaInicio,
          exitoso: true, // Se actualizará si hay errores
          tipo: 'automatica',
        });
      });

      console.log(
        `[FullSyncService] Iniciando sincronización completa (ID: ${syncLogId})`,
      );

      // Crear orquestador y ejecutar todas las tareas
      const orchestrator = new SyncOrchestrator(
        this.realm,
        syncLogId,
        sucursal,
        onProgress,
      );

      const result = await orchestrator.executeAll();

      // Actualizar log final
      const fechaFinal = new Date();
      const totalRegistros = Array.from(result.results.values()).reduce(
        (sum, r) =>
          sum + (r.registrosGuardados || 0) + (r.registrosActualizados || 0),
        0,
      );

      this.realm.write(() => {
        const log = this.realm!.objectForPrimaryKey('SyncLog', syncLogId);
        if (log) {
          log.fechaFinal = fechaFinal;
          log.exitoso = result.success;
          log.totalRegistros = totalRegistros;
          log.duracionMs = fechaFinal.getTime() - fechaInicio.getTime();
          if (!result.success) {
            log.razon = result.errors.join('; ');
          }
        }
      });

      console.log(
        `[FullSyncService] Sincronización completada. Éxito: ${result.success}, Total registros: ${totalRegistros}`,
      );

      return {
        success: result.success,
        error: result.success ? undefined : result.errors.join('; '),
      };
    } catch (error: any) {
      console.error('❌ Error durante la sincronización completa:', error);

      // Actualizar log con error crítico
      const fechaFinal = new Date();
      try {
        this.realm.write(() => {
          const log = this.realm!.objectForPrimaryKey('SyncLog', syncLogId);
          if (log) {
            log.fechaFinal = fechaFinal;
            log.exitoso = false;
            log.razon = error?.message || 'Error desconocido';
            log.duracionMs = fechaFinal.getTime() - fechaInicio.getTime();
          }
        });
      } catch (logError) {
        console.error('[FullSyncService] Error al actualizar log:', logError);
      }

      if (onProgress) {
        onProgress({
          current: 0,
          total: 0,
          entity: 'Error',
          status: 'error',
          message: error?.message || 'Error durante la sincronización',
        });
      }

      return { success: false, error: error?.message };
    }
  }

  /**
   * Sincroniza una tabla específica
   * Útil para sincronizaciones manuales o selectivas
   */
  async syncTable(
    tableName: string,
    sucursal: number = 1,
    onProgress?: SyncProgressCallback,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.realm) {
      throw new Error('Realm no inicializado');
    }

    // Crear SyncLog principal
    const syncLogId = `${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const fechaInicio = new Date();

    try {
      // Guardar log inicial
      this.realm.write(() => {
        this.realm!.create('SyncLog', {
          id: syncLogId,
          fechaInicio,
          exitoso: true,
          tipo: 'manual',
        });
      });

      console.log(
        `[FullSyncService] Iniciando sincronización de tabla: ${tableName} (ID: ${syncLogId})`,
      );

      // Crear orquestador y ejecutar tarea específica
      const orchestrator = new SyncOrchestrator(
        this.realm,
        syncLogId,
        sucursal,
        onProgress,
      );

      const result = await orchestrator.executeTask(tableName);

      if (!result) {
        throw new Error(`Tabla no encontrada: ${tableName}`);
      }

      // Actualizar log final
      const fechaFinal = new Date();
      const totalRegistros =
        (result.registrosGuardados || 0) + (result.registrosActualizados || 0);

      this.realm.write(() => {
        const log = this.realm!.objectForPrimaryKey('SyncLog', syncLogId);
        if (log) {
          log.fechaFinal = fechaFinal;
          log.exitoso = result.success;
          log.totalRegistros = totalRegistros;
          log.duracionMs = fechaFinal.getTime() - fechaInicio.getTime();
          if (!result.success) {
            log.razon = result.error || 'Error desconocido';
          }
        }
      });

      console.log(
        `[FullSyncService] Sincronización de ${tableName} completada. Éxito: ${result.success}`,
      );

      return {
        success: result.success,
        error: result.success ? undefined : result.error,
      };
    } catch (error: any) {
      // Actualizar log con error
      const fechaFinal = new Date();
      try {
        this.realm.write(() => {
          const log = this.realm!.objectForPrimaryKey('SyncLog', syncLogId);
          if (log) {
            log.fechaFinal = fechaFinal;
            log.exitoso = false;
            log.razon = error?.message || 'Error desconocido';
            log.duracionMs = fechaFinal.getTime() - fechaInicio.getTime();
          }
        });
      } catch (logError) {
        console.error('[FullSyncService] Error al actualizar log:', logError);
      }

      console.error(
        `[FullSyncService] Error en sincronización de ${tableName}:`,
        error,
      );
      return {
        success: false,
        error: error?.message || 'Error desconocido',
      };
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

  getVentasBySucursal(sucursal: number, limit: number = 10000): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(
      this.realm
        .objects('Venta')
        .filtered('sucursal == $0', sucursal)
        .sorted('fecha', true)
        .slice(0, limit),
    );
  }

  /**
   * Crea ventas locales en Realm (una fila por producto de la venta).
   * Se usa para registrar ventas hechas en el punto de venta antes de sincronizar.
   */
  async createLocalVentas(
    ventas: {
      id: number;
      idMovil?: number | null;
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
          idMovil: v.idMovil ?? null,
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

  getVentasByMovilId(idMovil: number): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(
      this.realm.objects('Venta').filtered('idMovil == $0', idMovil),
    );
  }

  /**
   * Actualiza el inventario restando las cantidades vendidas.
   * Busca el registro existente por sucursal y claveProd y actualiza el saldo.
   */
  async updateInventarioAfterSale(
    items: {
      sucursal: number;
      claveProd: number;
      cantidad: number;
    }[],
  ): Promise<void> {
    if (!items.length) return;

    if (!this.isInitialized || !this.realm) {
      await this.initialize();
    }
    if (!this.realm) return;

    this.realm.write(() => {
      items.forEach(item => {
        // Buscar el registro de inventario existente
        const inventario = this.realm!.objects('Inventario').filtered(
          'sucursal == $0 AND claveProd == $1',
          item.sucursal,
          item.claveProd,
        )[0] as any;

        if (inventario) {
          // Actualizar el saldo restando la cantidad vendida
          inventario.saldo = (inventario.saldo || 0) - item.cantidad;
          inventario.fechaArrastre = new Date();
          console.log(
            `[FullSync] Inventario actualizado: Producto ${
              item.claveProd
            }, Saldo anterior: ${
              (inventario.saldo || 0) + item.cantidad
            }, Nuevo saldo: ${inventario.saldo}`,
          );
        } else {
          console.warn(
            `[FullSync] No se encontró inventario para Producto ${item.claveProd} en Sucursal ${item.sucursal}`,
          );
        }
      });
    });
  }

  /**
   * Actualiza el inventario sumando las cantidades recibidas en un traspaso.
   * Busca el registro existente por sucursal y claveProd y actualiza el saldo.
   */
  async updateInventarioAfterReception(
    items: {
      sucursal: number;
      claveProd: number;
      cantidad: number;
    }[],
  ): Promise<void> {
    if (!items.length) return;

    if (!this.isInitialized || !this.realm) {
      await this.initialize();
    }
    if (!this.realm) return;

    this.realm.write(() => {
      items.forEach(item => {
        // Buscar el registro de inventario existente
        const inventario = this.realm!.objects('Inventario').filtered(
          'sucursal == $0 AND claveProd == $1',
          item.sucursal,
          item.claveProd,
        )[0] as any;

        if (inventario) {
          // Actualizar el saldo sumando la cantidad recibida
          inventario.saldo = (inventario.saldo || 0) + item.cantidad;
          inventario.fechaArrastre = new Date();
          console.log(
            `[FullSync] Inventario actualizado (recepción): Producto ${
              item.claveProd
            }, Saldo anterior: ${
              (inventario.saldo || 0) - item.cantidad
            }, Nuevo saldo: ${inventario.saldo}`,
          );
        } else {
          console.warn(
            `[FullSync] No se encontró inventario para Producto ${item.claveProd} en Sucursal ${item.sucursal}`,
          );
        }
      });
    });
  }

  /**
   * Crea movimientos locales en Inventario (por ejemplo, recepción de traspasos).
   * @deprecated Usar updateInventarioAfterSale para ventas
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
      tipoPago?: number | null;
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
          tipoPago: m.tipoPago ?? null,
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

  getVentasTotalEfectivoForDate(date: Date, sucursal?: number): number {
    if (!this.isInitialized || !this.realm) return 0;

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    let query =
      'fecha >= $0 AND fecha <= $1 AND tipoPago == 1 and id < 17000000000';
    const args: any[] = [start, end];

    if (sucursal !== undefined) {
      query += ' AND sucursal == $2';
      args.push(sucursal);
    }
    console.log(sucursal);
    const ventas = this.realm.objects('Venta').filtered(query, ...args);
    console.log(ventas);
    console.log('Venta:', ventas);
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

  getSyncTableLogsPaginated(offset: number = 0, limit: number = 50): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(
      this.realm
        .objects('SyncTableLog')
        .sorted('fechaInicio', true) // Más recientes primero
        .slice(offset, offset + limit),
    );
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
