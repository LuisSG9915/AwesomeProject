import Realm, { UpdateMode } from 'realm';
import { SyncTask, SyncTaskResult } from '../SyncTask';
import { CarteraSchema } from '../../RealmSchemas';

/**
 * Tarea de sincronización para la tabla Cartera
 */
export class CarteraSyncTask extends SyncTask {
  getTableName(): string {
    return 'Cartera';
  }

  getEndpoint(): string {
    return 'https://cbinfo.no-ip.info:9011/api/MovilesVentas/cartera-full';
  }

  getPriority(): number {
    return 6; // Sexta prioridad
  }

  getDependencies(): string[] {
    return ['Clientes']; // Depende de clientes para validar IDs
  }

  async execute(): Promise<SyncTaskResult> {
    try {
      console.log('[CarteraSyncTask] Obteniendo cartera desde API...');
      
      const response = await fetch(this.getEndpoint());
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const cartera = await response.json();
      const registrosLeidos = cartera.length;
      let registrosGuardados = 0;
      let registrosActualizados = 0;

      console.log(`[CarteraSyncTask] Leídos ${registrosLeidos} registros de cartera`);

      // Sincronizar con Realm
      this.realm.write(() => {
        for (const item of cartera) {
          const existing = this.realm.objectForPrimaryKey('Cartera', item.id);
          
          const carteraData = {
            ...item,
            syncedAt: new Date(),
          };

          if (existing) {
            this.realm.create('Cartera', carteraData, UpdateMode.Modified);
            registrosActualizados++;
          } else {
            this.realm.create('Cartera', carteraData);
            registrosGuardados++;
          }
        }
      });

      console.log(`[CarteraSyncTask] Guardados: ${registrosGuardados}, Actualizados: ${registrosActualizados}`);

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
      console.error('[CarteraSyncTask] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
}
