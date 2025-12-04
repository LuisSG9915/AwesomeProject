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
        schemaVersion: 6, // v6: SyncTableLogSchema + syncedAr en tablas de datos
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
   * Obtiene la última fecha syncedAr (horario México) de una tabla dada.
   * Si no hay registros o todas son null, regresa null.
   */
  private getLastSyncedAr(tableName: string): Date | null {
    if (!this.realm) return null;

    const collection: any = this.realm.objects(tableName);
    if (!collection || collection.length === 0) return null;

    const maxDate = collection.max('syncedAr') as Date | null;
    return maxDate || null;
  }

  /**
   * Normaliza un Date a un string "YYYY-MM-DD HH:mm" para fechaInicial.
   */
  private formatDateTimeForApi(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }

  /**
   * Normaliza un Date a un string "YYYY-MM-DD" para fechaInicial sin hora.
   */
  private formatDateForApi(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Obtiene la fecha/hora actual.
   * El dispositivo ya está en hora de México, no se requiere conversión.
   */
  private getMexicoNow(): Date {
    return new Date();
  }

  /**
   * Sincronización INCREMENTAL para background (cada 3 minutos).
   *
   * Usa los nuevos endpoints basados en fechaInicial, tomando como referencia
   * la fecha máxima de syncedAr (horario México) en cada tabla.
   *
   * Tablas cubiertas:
   * - Clientes  -> /api/MovilesVentas/clientes?fechaInicial=YYYY-MM-DD HH:mm
   * - Precios   -> /api/MovilesVentas/precios?fechaInicial=YYYY-MM-DD HH:mm
   * - Cartera   -> /api/MovilesVentas/cartera?fechaInicial=YYYY-MM-DD
   * - Ventas    -> /api/MovilesVentas/ventas-erp-movil?fechaInicial=YYYY-MM-DD HH:mm&sucursal=...
   */
  async syncIncremental(
    sucursal: number = 1,
    onProgress?: SyncProgressCallback,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.realm) {
      throw new Error('Realm no inicializado');
    }

    // Crear SyncLog principal específico para incremental
    const syncLogId = `${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const fechaInicio = new Date();

    this.realm.write(() => {
      this.realm!.create('SyncLog', {
        id: syncLogId,
        fechaInicio,
        exitoso: true,
        tipo: 'incremental',
      } as any);
    });

    // console.log(
    //   `[FullSyncService] Iniciando sincronización incremental (ID: ${syncLogId})`,
    // );

    const errors: string[] = [];
    const nowMexico = this.getMexicoNow();

    const notify = (
      entity: string,
      current: number,
      total: number,
      status: SyncProgress['status'],
      message: string,
    ) => {
      if (onProgress) {
        onProgress({ current, total, entity, status, message });
      }
    };

    // Tipo para resultado de tarea incremental
    type IncrementalTaskResult = {
      tabla: string;
      endpoint: string;
      registrosLeidos: number;
      registrosGuardados: number;
      registrosActualizados: number;
    };

    // Orden fijo de tablas incrementales
    const tasks: { name: string; run: () => Promise<IncrementalTaskResult> }[] =
      [
        {
          name: 'ClientesIncremental',
          run: async () => {
            const tableName = 'ClienteFull';
            const last = this.getLastSyncedAr(tableName) || new Date(0);
            const fechaInicial = this.formatDateTimeForApi(last);
            const url = `${
              this.apiBaseUrl
            }/api/MovilesVentas/clientes?fechaInicial=${encodeURIComponent(
              fechaInicial,
            )}`;

            // console.log('[Incremental] Clientes desde', fechaInicial, url);

            const response = await fetch(url, {
              headers: { accept: 'application/octet-stream' },
            });
            if (!response.ok) {
              throw new Error(`HTTP ${response.status} Clientes`);
            }

            const clientes = await response.json();
            const registrosLeidos = Array.isArray(clientes)
              ? clientes.length
              : 0;
            let registrosGuardados = 0;
            let registrosActualizados = 0;

            this.realm!.write(() => {
              for (const cliente of clientes) {
                const existing = this.realm!.objectForPrimaryKey(
                  'ClienteFull',
                  cliente.id,
                ) as any;

                const clienteData: any = {
                  id: cliente.id,
                  nombre: cliente.nombre,
                  longitud: cliente.longitud,
                  latitud: cliente.latitud,
                  idGrupo: cliente.idGrupo,
                  credito: cliente.credito,
                  facturacionMovil: cliente.facturacionMovil,
                  fechaAct: cliente.fecha_act
                    ? new Date(cliente.fecha_act)
                    : null,
                  correoFactura: cliente.correo_factura || null,
                  syncedAt: new Date(),
                  syncedAr: nowMexico,
                };

                if (existing) {
                  this.realm!.create(
                    'ClienteFull',
                    clienteData,
                    UpdateMode.Modified,
                  );
                  registrosActualizados++;
                } else {
                  this.realm!.create('ClienteFull', clienteData);
                  registrosGuardados++;
                }
              }
            });

            // console.log(
            //   `[Incremental] Clientes leídos=${registrosLeidos}, guardados=${registrosGuardados}, actualizados=${registrosActualizados}`,
            // );

            return {
              tabla: tableName,
              endpoint: url,
              registrosLeidos,
              registrosGuardados,
              registrosActualizados,
            };
          },
        },
        {
          name: 'PreciosIncremental',
          run: async () => {
            const tableName = 'Precio';
            const last = this.getLastSyncedAr(tableName) || new Date(0);
            const fechaInicial = this.formatDateTimeForApi(last);
            const url = `${
              this.apiBaseUrl
            }/api/MovilesVentas/precios?fechaInicial=${encodeURIComponent(
              fechaInicial,
            )}`;

            console.log('[Incremental] Precios desde', fechaInicial, url);

            const response = await fetch(url, {
              headers: { accept: 'application/octet-stream' },
            });
            if (!response.ok) {
              throw new Error(`HTTP ${response.status} Precios`);
            }

            const precios = await response.json();
            const registrosLeidos = Array.isArray(precios) ? precios.length : 0;
            let registrosGuardados = 0;
            let registrosActualizados = 0;

            this.realm!.write(() => {
              for (const precio of precios) {
                const existing = this.realm!.objectForPrimaryKey(
                  'Precio',
                  precio.id,
                ) as any;

                const precioData: any = {
                  ...precio,
                  syncedAt: new Date(),
                  syncedAr: nowMexico,
                };

                if (existing) {
                  this.realm!.create('Precio', precioData, UpdateMode.Modified);
                  registrosActualizados++;
                } else {
                  this.realm!.create('Precio', precioData);
                  registrosGuardados++;
                }
              }
            });

            console.log(
              `[Incremental] Precios leídos=${registrosLeidos}, guardados=${registrosGuardados}, actualizados=${registrosActualizados}`,
            );

            return {
              tabla: tableName,
              endpoint: url,
              registrosLeidos,
              registrosGuardados,
              registrosActualizados,
            };
          },
        },
        {
          name: 'CarteraIncremental',
          run: async () => {
            const tableName = 'Cartera';
            const last = this.getLastSyncedAr(tableName) || new Date(0);
            const fechaInicial = this.formatDateForApi(last);
            const url = `${
              this.apiBaseUrl
            }/api/MovilesVentas/cartera?fechaInicial=${encodeURIComponent(
              fechaInicial,
            )}`;

            console.log('[Incremental] Cartera desde', fechaInicial, url);

            const response = await fetch(url, {
              headers: { accept: 'application/octet-stream' },
            });
            if (!response.ok) {
              throw new Error(`HTTP ${response.status} Cartera`);
            }

            const cartera = await response.json();
            const registrosLeidos = Array.isArray(cartera) ? cartera.length : 0;
            let registrosGuardados = 0;
            let registrosActualizados = 0;

            this.realm!.write(() => {
              for (const item of cartera) {
                const existing = this.realm!.objectForPrimaryKey(
                  'Cartera',
                  item.id,
                ) as any;

                const carteraData: any = {
                  ...item,
                  syncedAt: new Date(),
                  syncedAr: nowMexico,
                };

                if (existing) {
                  this.realm!.create(
                    'Cartera',
                    carteraData,
                    UpdateMode.Modified,
                  );
                  registrosActualizados++;
                } else {
                  this.realm!.create('Cartera', carteraData);
                  registrosGuardados++;
                }
              }
            });

            // console.log(
            //   `[Incremental] Cartera leídos=${registrosLeidos}, guardados=${registrosGuardados}, actualizados=${registrosActualizados}`,
            // );

            return {
              tabla: tableName,
              endpoint: url,
              registrosLeidos,
              registrosGuardados,
              registrosActualizados,
            };
          },
        },
        {
          name: 'VentasIncremental',
          run: async () => {
            const tableName = 'Venta';
            const last = this.getLastSyncedAr(tableName) || new Date(0);
            const fechaInicial = this.formatDateTimeForApi(last);
            const url = `${
              this.apiBaseUrl
            }/api/MovilesVentas/ventas-erp-movil?fechaInicial=${encodeURIComponent(
              fechaInicial,
            )}&sucursal=${encodeURIComponent(String(sucursal))}`;

            console.log('[Incremental] Ventas desde', fechaInicial, url);

            const response = await fetch(url, {
              headers: { accept: 'application/octet-stream' },
            });
            if (!response.ok) {
              throw new Error(`HTTP ${response.status} Ventas`);
            }

            const ventas = await response.json();
            console.log(ventas, 'Ventas sincronizadas');
            const registrosLeidos = Array.isArray(ventas) ? ventas.length : 0;
            let registrosGuardados = 0;
            let registrosActualizados = 0;

            // Solo actualizar registros locales con id > 1700000000
            // Buscar por idMovil y actualizar solo: noVenta, folioFactura, facturacionMovil
            this.realm!.write(() => {
              for (const venta of ventas) {
                // Buscar registro local por idMovil donde id > 1700000000
                const localVentas = this.realm!.objects('Venta').filtered(
                  'idMovil == $0 AND id > 1700000000',
                  venta.idMovil,
                );

                if (localVentas.length > 0) {
                  // Actualizar solo los campos específicos en cada registro encontrado
                  for (const localVenta of localVentas) {
                    (localVenta as any).noVenta = venta.noVenta;
                    (localVenta as any).folioFactura = venta.folioFactura;
                    (localVenta as any).facturacionMovil =
                      venta.facturacionMovil;
                    (localVenta as any).syncedAt = nowMexico;
                    registrosActualizados++;
                  }
                }
              }

              // Actualizar syncedAr en TODOS los registros locales con id > 1700000000
              const allLocalVentas =
                this.realm!.objects('Venta').filtered('id > 1700000000');
              for (const localVenta of allLocalVentas) {
                (localVenta as any).syncedAr = nowMexico;
              }
            });

            console.log(
              `[Incremental] Ventas leídos=${registrosLeidos}, guardados=${registrosGuardados}, actualizados=${registrosActualizados}`,
            );

            return {
              tabla: tableName,
              endpoint: url,
              registrosLeidos,
              registrosGuardados,
              registrosActualizados,
            };
          },
        },
        {
          name: 'InventarioIncremental',
          run: async () => {
            const tableName = 'Inventario';
            const url = `${
              this.apiBaseUrl
            }/api/MovilesVentas/inventario-erp-movil/${sucursal}?fechaMovto=${new Date().toISOString()}`;

            console.log('[Incremental] Inventario desde', url);

            const response = await fetch(url, {
              headers: { accept: 'application/octet-stream' },
            });
            if (!response.ok) {
              throw new Error(`HTTP ${response.status} Inventario`);
            }

            const inventario = await response.json();
            const registrosLeidos = Array.isArray(inventario)
              ? inventario.length
              : 0;
            let registrosGuardados = 0;
            let registrosActualizados = 0;

            this.realm!.write(() => {
              for (const item of inventario) {
                const existing = this.realm!.objectForPrimaryKey(
                  'Inventario',
                  item.id,
                );

                const inventarioData = {
                  ...item,
                  sucursal: sucursal,
                  syncedAt: item.fechaArrastre
                    ? new Date(item.fechaArrastre)
                    : new Date(),
                  syncedAr: nowMexico,
                };

                if (existing) {
                  this.realm!.create(
                    'Inventario',
                    inventarioData,
                    UpdateMode.Modified,
                  );
                  registrosActualizados++;
                } else {
                  this.realm!.create('Inventario', inventarioData);
                  registrosGuardados++;
                }
              }
            });

            console.log(
              `[Incremental] Inventario leídos=${registrosLeidos}, guardados=${registrosGuardados}, actualizados=${registrosActualizados}`,
            );

            return {
              tabla: tableName,
              endpoint: url,
              registrosLeidos,
              registrosGuardados,
              registrosActualizados,
            };
          },
        },
      ];

    const totalTasks = tasks.length;
    let currentTask = 0;

    for (const task of tasks) {
      currentTask++;
      const fechaInicioTask = new Date();
      notify(
        task.name,
        currentTask,
        totalTasks,
        'syncing',
        `Sincronizando ${task.name}...`,
      );

      try {
        const result = await task.run();
        const fechaFinalTask = new Date();

        // Guardar bitácora por tabla
        this.realm!.write(() => {
          this.realm!.create('SyncTableLog', {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            syncLogId,
            tabla: result.tabla,
            fechaInicio: fechaInicioTask,
            fechaFinal: fechaFinalTask,
            exitoso: true,
            razon: null,
            registrosLeidos: result.registrosLeidos,
            registrosGuardados: result.registrosGuardados,
            registrosActualizados: result.registrosActualizados,
            duracionMs: fechaFinalTask.getTime() - fechaInicioTask.getTime(),
            endpoint: result.endpoint,
            detalles: null,
          });
        });

        notify(
          task.name,
          currentTask,
          totalTasks,
          'success',
          `${task.name} sincronizado`,
        );
      } catch (error: any) {
        const msg = error?.message || 'Error desconocido';
        console.error(
          `[FullSyncService] Error incremental en ${task.name}:`,
          msg,
        );
        errors.push(`${task.name}: ${msg}`);
        notify(
          task.name,
          currentTask,
          totalTasks,
          'error',
          `Error en ${task.name}: ${msg}`,
        );
      }
    }

    const fechaFinal = new Date();

    // Actualizar SyncLog
    this.realm.write(() => {
      const log: any = this.realm!.objectForPrimaryKey('SyncLog', syncLogId);
      if (log) {
        log.fechaFinal = fechaFinal;
        log.exitoso = errors.length === 0;
        log.totalRegistros = undefined;
        log.duracionMs = fechaFinal.getTime() - fechaInicio.getTime();
        if (errors.length > 0) {
          log.razon = errors.join('; ');
        }
      }
    });

    const success = errors.length === 0;
    // console.log(
    //   `[FullSyncService] Sincronización incremental completada. Éxito: ${success}, Errores: ${errors.length}`,
    // );

    return {
      success,
      error: success ? undefined : errors.join('; '),
    };
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

      // console.log(
      //   `[FullSyncService] Iniciando sincronización completa (ID: ${syncLogId})`,
      // );

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

      // console.log(
      //   `[FullSyncService] Sincronización completada. Éxito: ${result.success}, Total registros: ${totalRegistros}`,
      // );

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

      // console.log(
      //   `[FullSyncService] Iniciando sincronización de tabla: ${tableName} (ID: ${syncLogId})`,
      // );

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

      // console.log(
      //   `[FullSyncService] Sincronización de ${tableName} completada. Éxito: ${result.success}`,
      // );

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
          // console.log(
          //   `[FullSync] Inventario actualizado: Producto ${
          //     item.claveProd
          //   }, Saldo anterior: ${
          //     (inventario.saldo || 0) + item.cantidad
          //   }, Nuevo saldo: ${inventario.saldo}`,
          // );
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
          // console.log(
          //   `[FullSync] Inventario actualizado (recepción): Producto ${
          //     item.claveProd
          //   }, Saldo anterior: ${
          //     (inventario.saldo || 0) - item.cantidad
          //   }, Nuevo saldo: ${inventario.saldo}`,
          // );
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
    // console.log(sucursal);
    const ventas = this.realm.objects('Venta').filtered(query, ...args);
    // console.log(ventas);
    // console.log('Venta:', ventas);
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

  /**
   * Envía las ventas locales pendientes al servidor.
   * Solo envía ventas con id >= LOCAL_SALE_ID_THRESHOLD y noVenta === 0.
   * Se puede usar desde SalesScreen o desde la sincronización periódica.
   */
  async sendPendingVentasToServer(
    sucursal: number,
    idUsuario: number,
  ): Promise<{ success: boolean; sent: number; error?: string }> {
    const LOCAL_SALE_ID_THRESHOLD = 1700000000;

    try {
      if (!this.isInitialized || !this.realm) {
        await this.initialize();
      }
      if (!this.realm) {
        return { success: false, sent: 0, error: 'Realm no inicializado' };
      }

      const ventasRealm = this.getVentas();

      // Solo enviar ventas locales (id >= threshold) y sin número de venta asignado
      const ventasLocales = ventasRealm.filter(
        (venta: any) =>
          venta.noVenta === 0 && venta.id >= LOCAL_SALE_ID_THRESHOLD,
      );

      console.log('[FullSyncService] Filtering local sales', {
        totalVentas: ventasRealm.length,
        localVentas: ventasLocales.length,
        threshold: LOCAL_SALE_ID_THRESHOLD,
      });

      if (ventasLocales.length === 0) {
        console.log('[FullSyncService] No pending ventas to send');
        return { success: true, sent: 0 };
      }

      const payload = ventasLocales.map((venta: any) => {
        const cliente = venta.cveCliente
          ? this.getClienteFullById(venta.cveCliente)
          : null;

        return {
          sucursal: venta.sucursal ?? sucursal,
          clave_prod: venta.claveProd ?? 0,
          Cant_producto: venta.cantProducto ?? 0,
          precio: venta.precio ?? 0,
          Cve_cliente: venta.cveCliente ?? 0,
          fecha: (venta.fecha ?? new Date()).toISOString(),
          tipo_pago: venta.tipoPago ?? 1,
          usuario: idUsuario,
          longitud: cliente?.longitud ?? 0,
          latitud: cliente?.latitud ?? 0,
          id_movil: venta.idMovil,
          fechaTransfer: new Date().toISOString(),
        };
      });

      console.log('[FullSyncService] Payload to send:', payload);

      const url = `${
        this.apiBaseUrl
      }/api/MovilesVentas/sp_MovilesVentasArrastreJSON?sucursal=${encodeURIComponent(
        String(sucursal),
      )}&idUsuario=${encodeURIComponent(String(idUsuario))}`;

      console.log('[FullSyncService] Sending ventas arrastre', {
        url,
        rows: payload.length,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(
          '[FullSyncService] Error sending ventas arrastre',
          response.status,
          errorText,
        );
        return {
          success: false,
          sent: 0,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      console.log(
        '[FullSyncService] Ventas arrastre sent successfully',
        response.status,
      );
      return { success: true, sent: payload.length };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Error desconocido';
      console.error('[FullSyncService] Error sending ventas arrastre', error);
      return { success: false, sent: 0, error: errorMsg };
    }
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
