import Realm, { UpdateMode } from 'realm';
import { SyncTask, SyncTaskResult } from '../SyncTask';
import { PrecioSchema } from '../../RealmSchemas';

/**
 * Tarea de sincronización para la tabla Precios
 */
export class PreciosSyncTask extends SyncTask {
  getTableName(): string {
    return 'Precios';
  }

  getEndpoint(): string {
    return 'https://cbinfo.no-ip.info:9011/api/MovilesVentas/precios-full';
  }

  getPriority(): number {
    return 3; // Tercera prioridad - precios después de productos
  }

  getDependencies(): string[] {
    return ['Productos']; // Depende de productos para validar claves
  }

  async execute(): Promise<SyncTaskResult> {
    try {
      console.log('[PreciosSyncTask] Obteniendo precios desde API...');
      
      const response = await fetch(this.getEndpoint());
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const precios = await response.json();
      const registrosLeidos = precios.length;
      const nowMexico = this.getMexicoNow();
      let registrosGuardados = 0;
      let registrosActualizados = 0;

      console.log(`[PreciosSyncTask] Leídos ${registrosLeidos} precios`);

      // Sincronizar con Realm
      this.realm.write(() => {
        for (const precio of precios) {
          const existing = this.realm.objectForPrimaryKey('Precio', precio.id);
          
          const precioData = {
            ...precio,
            syncedAt: new Date(),
            syncedAr: nowMexico,
          };

          if (existing) {
            this.realm.create('Precio', precioData, UpdateMode.Modified);
            registrosActualizados++;
          } else {
            this.realm.create('Precio', precioData);
            registrosGuardados++;
          }
        }
      });

      console.log(`[PreciosSyncTask] Guardados: ${registrosGuardados}, Actualizados: ${registrosActualizados}`);

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
      console.error('[PreciosSyncTask] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
}
