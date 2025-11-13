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
        schemaVersion: 1,
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
    onProgress?: SyncProgressCallback
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
              message: `${task.name} sincronizado (${result.count || 0} registros)`,
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

  private async syncVentas(sucursal: number): Promise<{ success: boolean; error?: string; count?: number }> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/MovilesVentas/ventas-full/${sucursal}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor');
      }

      this.realm!.write(() => {
        // Limpiar ventas anteriores de esta sucursal
        const existingVentas = this.realm!.objects('Venta').filtered('sucursal == $0', sucursal);
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

  private async syncUsuarios(): Promise<{ success: boolean; error?: string; count?: number }> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/MovilesVentas/usuarios-full`
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
            UpdateMode.Modified
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

  private async syncProductos(): Promise<{ success: boolean; error?: string; count?: number }> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/MovilesVentas/productos-full`
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
            UpdateMode.Modified
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

  private async syncPrecios(): Promise<{ success: boolean; error?: string; count?: number }> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/MovilesVentas/precios-full`
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
            UpdateMode.Modified
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
    fechaMovto: string = new Date().toISOString().split('T')[0]
  ): Promise<{ success: boolean; error?: string; count?: number }> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/MovilesVentas/inventario-erp-movil/${sucursal}?fechaMovto=${fechaMovto}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor');
      }

      this.realm!.write(() => {
        // Limpiar inventario anterior de esta sucursal
        const existingInventario = this.realm!.objects('Inventario').filtered('sucursal == $0', sucursal);
        this.realm!.delete(existingInventario);

        // Insertar nuevo inventario
        data.forEach((inventario: any) => {
          this.realm!.create('Inventario', {
            id: inventario.id,
            sucursal: inventario.sucursal,
            claveProd: inventario.claveProd,
            fechaArrastre: inventario.fechaArrastre ? new Date(inventario.fechaArrastre) : null,
            saldo: inventario.saldo,
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

  private async syncCartera(): Promise<{ success: boolean; error?: string; count?: number }> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/MovilesVentas/cartera-full`
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
            UpdateMode.Modified
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

  private async syncClientesFull(): Promise<{ success: boolean; error?: string; count?: number }> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/MovilesVentas/clientes-full`
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
            UpdateMode.Modified
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
        UpdateMode.Modified
      );
    });
  }

  // Métodos para consultar datos
  getVentas(limit: number = 100): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(this.realm.objects('Venta').sorted('fecha', true).slice(0, limit));
  }

  getUsuarios(limit: number = 100): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(this.realm.objects('Usuario').sorted('nombre').slice(0, limit));
  }

  getProductos(limit: number = 100): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(this.realm.objects('Producto').sorted('descripcion').slice(0, limit));
  }

  getPrecios(limit: number = 100): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(this.realm.objects('Precio').sorted('descripcion').slice(0, limit));
  }

  getInventario(limit: number = 100): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(this.realm.objects('Inventario').slice(0, limit));
  }

  getCartera(limit: number = 100): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(this.realm.objects('Cartera').sorted('nombreCliente').slice(0, limit));
  }

  getClientesFull(limit: number = 100): any[] {
    if (!this.isInitialized || !this.realm) return [];
    return Array.from(this.realm.objects('ClienteFull').sorted('nombre').slice(0, limit));
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
