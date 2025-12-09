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

      console.log(ventas);

      // Encontrar el registro con el ID más alto del servidor
      let maxIdVenta = null;
      let maxId = 0;
      for (const venta of ventas) {
        if (venta.id && venta.id > maxId) {
          maxId = venta.id;
          maxIdVenta = venta;
        }
      }
      
      // Obtener el fechaLog del registro con el ID más alto
      const syncedArValue = maxIdVenta?.fecha ?? nowMexico;
      
      console.log(`[VentasSyncTask] ID más alto del servidor: ${maxId}, fechaLog: ${syncedArValue}`);

      this.realm.write(() => {
        for (const venta of ventas) {
          const idMovil = venta.idMovil ?? null;

          // Primero verificar si existe por ID (primary key)
          const existingById = this.realm.objectForPrimaryKey('Venta', venta.id);

          if (existingById) {
            // Actualizar registro existente por ID
            (existingById as any).noVenta = venta.noVenta;
            (existingById as any).cantProducto = venta.cantProducto;
            (existingById as any).precio = venta.precio;
            (existingById as any).importe = venta.importe;
            (existingById as any).folioFactura = venta.folioFactura;
            (existingById as any).facturacionMovil = venta.facturacionMovil;
            (existingById as any).syncedAt = venta.fechaLog
              ? new Date(venta.fechaLog)
              : nowMexico;
            registrosActualizados++;
          } else {
            // Buscar por idMovil Y claveProd exactos en registros locales (id > 1700000000000)
            const localVentas =
              idMovil === null
                ? []
                : this.realm.objects('Venta').filtered(
                    'idMovil == $0 AND claveProd == $1 AND id > 1700000000000',
                    idMovil,
                    venta.claveProd,
                  );

            if (localVentas.length > 0) {
              // Actualizar solo los campos específicos en cada registro encontrado
              for (const localVenta of localVentas) {
                (localVenta as any).noVenta = venta.noVenta;
                (localVenta as any).cantProducto = venta.cantProducto;
                (localVenta as any).precio = venta.precio;
                (localVenta as any).importe = venta.importe;
                (localVenta as any).folioFactura = venta.folioFactura;
                (localVenta as any).facturacionMovil = venta.facturacionMovil;
                (localVenta as any).syncedAt = venta.fechaLog
                  ? new Date(venta.fechaLog)
                  : nowMexico;
                registrosActualizados++;
              }
            } else {
              // Crear registro porque no existe ni por ID ni por idMovil+claveProd
              this.realm.create('Venta', {
                id: venta.id,
                idMovil: venta.idMovil ?? null,
                sucursal: venta.sucursal ?? null,
                noVenta: venta.noVenta ?? null,
                claveProd: venta.claveProd ?? null,
                nombreProducto: venta.nombreProducto ?? null,
                cantProducto: venta.cantProducto ?? null,
                precio: venta.precio ?? null,
                importe: venta.importe ?? null,
                cveCliente: venta.cveCliente ?? null,
                nombreCliente: venta.nombreCliente ?? null,
                fecha: venta.fecha ? new Date(venta.fecha) : null,
                tipoPago: venta.tipoPago ?? null,
                descripcionMedioPago: venta.descripcionMedioPago ?? null,
                vendedor: venta.vendedor ?? null,
                folioFactura: venta.folioFactura ?? false,
                facturacionMovil: venta.facturacionMovil ?? false,
                syncedAt: venta.fechaLog ? new Date(venta.fechaLog) : nowMexico,
                syncedAr: syncedArValue,
              });
              registrosGuardados++;
            }
          }
        }

        // Actualizar syncedAr en TODOS los registros locales con el fechaLog del ID más alto del servidor
        const allLocalVentas = this.realm
          .objects('Venta')
          .filtered('id > 1700000000');
        for (const localVenta of allLocalVentas) {
          (localVenta as any).syncedAr = syncedArValue;
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
