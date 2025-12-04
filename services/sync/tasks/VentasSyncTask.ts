import Realm, { UpdateMode } from 'realm';
import { SyncTask, SyncTaskResult } from '../SyncTask';
import { VentaSchema } from '../../RealmSchemas';

/**
 * Tarea de sincronización para la tabla Ventas
 */
export class VentasSyncTask extends SyncTask {
  private sucursal: number;

  constructor(realm: Realm, syncLogId: string, sucursal: number) {
    super(realm, syncLogId);
    this.sucursal = sucursal;
  }

  getTableName(): string {
    return 'Ventas';
  }

  getEndpoint(): string {
    return `https://cbinfo.no-ip.info:9011/api/MovilesVentas/ventas-full/${this.sucursal}`;
  }

  getPriority(): number {
    return 7; // Última prioridad - ventas después de todo lo demás
  }

  getDependencies(): string[] {
    return ['Usuarios', 'Clientes', 'Productos']; // Depende de usuarios, clientes y productos
  }

  async execute(): Promise<SyncTaskResult> {
    try {
      console.log(
        `[VentasSyncTask] Obteniendo ventas para sucursal ${this.sucursal}...`,
      );

      const response = await fetch(this.getEndpoint());
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      console.log(response);
      const ventas = await response.json();
      const registrosLeidos = ventas.length;
      const nowMexico = this.getMexicoNow();
      let registrosGuardados = 0;
      let registrosActualizados = 0;

      console.log(
        `[VentasSyncTask] Leídos ${registrosLeidos} registros de ventas`,
      );

      // Sincronizar con Realm - Solo actualizar registros locales con id > 1700000000
      // Buscar por idMovil y actualizar solo: noVenta, folioFactura, facturacionMovil
      this.realm.write(() => {
        for (const venta of ventas) {
          // Buscar registro local por idMovil donde id > 1700000000
          const localVentas = this.realm
            .objects('Venta')
            .filtered('idMovil == $0 AND id > 1700000000 ', venta.idMovil);

          if (localVentas.length > 0) {
            // Actualizar solo los campos específicos en cada registro encontrado
            for (const localVenta of localVentas) {
              (localVenta as any).noVenta = venta.noVenta;
              (localVenta as any).folioFactura = venta.folioFactura;
              (localVenta as any).facturacionMovil = venta.facturacionMovil;
              (localVenta as any).syncedAt = venta.fechaLog;
              registrosActualizados++;
            }
          }
        }

        // Actualizar syncedAr en TODOS los registros locales con id > 1700000000
        const allLocalVentas = this.realm
          .objects('Venta')
          .filtered('id > 1700000000');
        for (const localVenta of allLocalVentas) {
          (localVenta as any).syncedAr = nowMexico;
        }
      });

      console.log(
        `[VentasSyncTask] Guardados: ${registrosGuardados}, Actualizados: ${registrosActualizados}`,
      );
      console.log(ventas);
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
      console.error('[VentasSyncTask] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
}
