import Realm, { UpdateMode } from 'realm';
import { SyncTask, SyncTaskResult } from '../SyncTask';
import { ClienteFullSchema } from '../../RealmSchemas';

/**
 * Tarea de sincronización para la tabla Clientes
 */
export class ClientesSyncTask extends SyncTask {
  getTableName(): string {
    return 'Clientes';
  }

  getEndpoint(): string {
    return 'https://cbinfo.no-ip.info:9011/api/MovilesVentas/clientes-full';
  }

  getPriority(): number {
    return 4; // Cuarta prioridad
  }

  getDependencies(): string[] {
    return []; // Sin dependencias
  }

  async execute(): Promise<SyncTaskResult> {
    try {
      console.log('[ClientesSyncTask] Obteniendo clientes desde API...');

      const response = await fetch(this.getEndpoint());
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const clientes = await response.json();
      const registrosLeidos = clientes.length;
      const nowMexico = this.getMexicoNow();
      let registrosGuardados = 0;
      let registrosActualizados = 0;
      let registrosEliminados = 0;

      console.log(`[ClientesSyncTask] Leídos ${registrosLeidos} clientes`);

      // Sincronizar con Realm
      this.realm.write(() => {
        // Crear Set con IDs del servidor para búsqueda rápida
        const serverIds = new Set(clientes.map((c: any) => c.id));

        // Obtener todos los clientes locales
        const localClientes = this.realm.objects('ClienteFull');
        const clientesToDelete: Realm.Object[] = [];

        // Identificar clientes locales que no están en el servidor
        for (const localCliente of localClientes) {
          const localId = (localCliente as any).id;
          if (!serverIds.has(localId)) {
            clientesToDelete.push(localCliente);
          }
        }

        // Eliminar clientes que no están en el servidor
        for (const clienteToDelete of clientesToDelete) {
          this.realm.delete(clienteToDelete);
          registrosEliminados++;
        }

        if (registrosEliminados > 0) {
          console.log(
            `[ClientesSyncTask] Eliminados ${registrosEliminados} clientes que no están en el servidor`,
          );
        }

        // Actualizar/Insertar clientes del servidor
        for (const cliente of clientes) {
          const existing = this.realm.objectForPrimaryKey(
            'ClienteFull',
            cliente.id,
          );

          const clienteData = {
            id: cliente.id,
            nombre: cliente.nombre,
            longitud: cliente.longitud,
            latitud: cliente.latitud,
            idGrupo: cliente.idGrupo,
            credito: cliente.credito,
            facturacionMovil: cliente.facturacionMovil,
            fechaAct: cliente.fecha_act ? new Date(cliente.fecha_act) : null,
            correoFactura: cliente.correoFactura || null,
            syncedAt: new Date(),
            syncedAr: cliente.fechaLog ? new Date(cliente.fechaLog) : null,
          };

          if (existing) {
            this.realm.create('ClienteFull', clienteData, UpdateMode.Modified);
            registrosActualizados++;
          } else {
            this.realm.create('ClienteFull', clienteData);
            registrosGuardados++;
          }
        }
      });

      console.log(
        `[ClientesSyncTask] Guardados: ${registrosGuardados}, Actualizados: ${registrosActualizados}, Eliminados: ${registrosEliminados}`,
      );

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
      console.error('[ClientesSyncTask] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
}
