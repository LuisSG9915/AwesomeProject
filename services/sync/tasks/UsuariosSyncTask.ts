import Realm, { UpdateMode } from 'realm';
import { SyncTask, SyncTaskResult } from '../SyncTask';
import { UsuarioSchema } from '../../RealmSchemas';

/**
 * Tarea de sincronización para la tabla Usuarios
 */
export class UsuariosSyncTask extends SyncTask {
  getTableName(): string {
    return 'Usuarios';
  }

  getEndpoint(): string {
    return 'https://cbinfo.no-ip.info:9011/api/MovilesVentas/usuarios-full';
  }

  getPriority(): number {
    return 1; // Alta prioridad - usuarios primero
  }

  getDependencies(): string[] {
    return []; // Sin dependencias
  }

  async execute(): Promise<SyncTaskResult> {
    try {
      console.log('[UsuariosSyncTask] Obteniendo usuarios desde API...');
      
      const response = await fetch(this.getEndpoint());
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const usuarios = await response.json();
      const registrosLeidos = usuarios.length;
      let registrosGuardados = 0;
      let registrosActualizados = 0;

      console.log(`[UsuariosSyncTask] Leídos ${registrosLeidos} usuarios`);

      // Sincronizar con Realm
      this.realm.write(() => {
        for (const usuario of usuarios) {
          const existing = this.realm.objectForPrimaryKey('Usuario', usuario.id);
          
          const usuarioData = {
            ...usuario,
            syncedAt: new Date(),
          };

          if (existing) {
            this.realm.create('Usuario', usuarioData, UpdateMode.Modified);
            registrosActualizados++;
          } else {
            this.realm.create('Usuario', usuarioData);
            registrosGuardados++;
          }
        }
      });

      console.log(`[UsuariosSyncTask] Guardados: ${registrosGuardados}, Actualizados: ${registrosActualizados}`);

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
      console.error('[UsuariosSyncTask] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
}
