import Realm, { UpdateMode } from 'realm';
import { SyncTask, SyncTaskResult } from '../SyncTask';
import { ProductoSchema } from '../../RealmSchemas';

/**
 * Tarea de sincronización para la tabla Productos
 */
export class ProductosSyncTask extends SyncTask {
  getTableName(): string {
    return 'Productos';
  }

  getEndpoint(): string {
    return 'https://cbinfo.no-ip.info:9011/api/MovilesVentas/productos-full';
  }

  getPriority(): number {
    return 2; // Segunda prioridad - productos después de usuarios
  }

  getDependencies(): string[] {
    return []; // Sin dependencias
  }

  async execute(): Promise<SyncTaskResult> {
    try {
      console.log('[ProductosSyncTask] Obteniendo productos desde API...');
      
      const response = await fetch(this.getEndpoint());
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const productos = await response.json();
      const registrosLeidos = productos.length;
      let registrosGuardados = 0;
      let registrosActualizados = 0;

      console.log(`[ProductosSyncTask] Leídos ${registrosLeidos} productos`);

      // Sincronizar con Realm
      this.realm.write(() => {
        for (const producto of productos) {
          const existing = this.realm.objectForPrimaryKey('Producto', producto.id);
          
          const productoData = {
            ...producto,
            syncedAt: new Date(),
          };

          if (existing) {
            this.realm.create('Producto', productoData, UpdateMode.Modified);
            registrosActualizados++;
          } else {
            this.realm.create('Producto', productoData);
            registrosGuardados++;
          }
        }
      });

      console.log(`[ProductosSyncTask] Guardados: ${registrosGuardados}, Actualizados: ${registrosActualizados}`);

      return {
        success: true,
        registrosLeidos,
        registrosGuardados,
        registrosActualizados,
        detalles: {
          totalProcesados: registrosGuardados + registrosActualizados,
        },
      };
    } catch (error) {
      console.error('[ProductosSyncTask] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
}
