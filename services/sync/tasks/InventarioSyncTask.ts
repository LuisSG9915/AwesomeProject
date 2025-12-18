import Realm, { UpdateMode } from 'realm';
import { SyncTask, SyncTaskResult } from '../SyncTask';
import { InventarioSchema } from '../../RealmSchemas';

/**
 * Tarea de sincronización para la tabla Inventario
 */
export class InventarioSyncTask extends SyncTask {
  private sucursal: number;

  constructor(realm: Realm, syncLogId: string, sucursal: number) {
    super(realm, syncLogId);
    this.sucursal = sucursal;
  }

  getTableName(): string {
    return 'Inventario';
  }

  getEndpoint(): string {
    // Formatear fecha en horario local mexicano (YYYY-MM-DD HH:mm:ss)
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const fechaLocal = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;

    return `https://cbinfo.no-ip.info:9011/api/MovilesVentas/inventario-erp-movil/${
      this.sucursal
    }?fechaMovto=${encodeURIComponent(fechaLocal)}`;
  }
  getPriority(): number {
    return 5; // Quinta prioridad
  }

  getDependencies(): string[] {
    return ['Productos']; // Depende de productos para validar claves
  }

  async execute(): Promise<SyncTaskResult> {
    try {
      console.log(
        `[InventarioSyncTask] Obteniendo inventario para sucursal ${this.sucursal}...`,
      );

      const response = await fetch(this.getEndpoint());
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const inventario = await response.json();
      const registrosLeidos = inventario.length;
      const nowMexico = this.getMexicoNow();
      let registrosGuardados = 0;
      let registrosActualizados = 0;

      console.log(
        `[InventarioSyncTask] Leídos ${registrosLeidos} registros de inventario`,
      );

      // Sincronizar con Realm
      this.realm.write(() => {
        for (const item of inventario) {
          const existing = this.realm.objectForPrimaryKey(
            'Inventario',
            item.id,
          );

          const inventarioData = {
            ...item,
            sucursal: this.sucursal,
            syncedAt: item.fechaArrastre
              ? new Date(item.fechaArrastre)
              : nowMexico,
            syncedAr: nowMexico,
          };
          console.log(inventarioData);
          if (existing) {
            this.realm.create(
              'Inventario',
              inventarioData,
              UpdateMode.Modified,
            );
            registrosActualizados++;
          } else {
            this.realm.create('Inventario', inventarioData);
            registrosGuardados++;
          }
        }
      });

      console.log(
        `[InventarioSyncTask] Guardados: ${registrosGuardados}, Actualizados: ${registrosActualizados}`,
      );

      return {
        success: true,
        registrosLeidos,
        registrosGuardados,
        registrosActualizados,
        detalles: {
          totalProcesados: registrosGuardados + registrosActualizados,
          sucursal: this.sucursal,
        },
      };
    } catch (error) {
      console.error('[InventarioSyncTask] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
}
