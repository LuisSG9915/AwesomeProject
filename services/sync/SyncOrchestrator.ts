import Realm from 'realm';
import { SyncTask, SyncTaskResult, SyncProgress } from './SyncTask';
import { UsuariosSyncTask } from './tasks/UsuariosSyncTask';
import { ProductosSyncTask } from './tasks/ProductosSyncTask';
import { PreciosSyncTask } from './tasks/PreciosSyncTask';
import { ClientesSyncTask } from './tasks/ClientesSyncTask';
import { InventarioSyncTask } from './tasks/InventarioSyncTask';
import { CarteraSyncTask } from './tasks/CarteraSyncTask';
import { VentasSyncTask } from './tasks/VentasSyncTask';

/**
 * Orquestador de sincronización
 * Maneja la ejecución de tareas con dependencias y prioridades
 */
export class SyncOrchestrator {
  private realm: Realm;
  private syncLogId: string;
  private sucursal: number;
  private onProgress?: (progress: SyncProgress) => void;

  constructor(
    realm: Realm,
    syncLogId: string,
    sucursal: number,
    onProgress?: (progress: SyncProgress) => void,
  ) {
    this.realm = realm;
    this.syncLogId = syncLogId;
    this.sucursal = sucursal;
    this.onProgress = onProgress;
  }

  /**
   * Crea todas las tareas de sincronización
   */
  private createAllTasks(): SyncTask[] {
    return [
      new UsuariosSyncTask(this.realm, this.syncLogId),
      new ProductosSyncTask(this.realm, this.syncLogId),
      new PreciosSyncTask(this.realm, this.syncLogId),
      new ClientesSyncTask(this.realm, this.syncLogId),
      new InventarioSyncTask(this.realm, this.syncLogId, this.sucursal),
      new CarteraSyncTask(this.realm, this.syncLogId),
      new VentasSyncTask(this.realm, this.syncLogId, this.sucursal),
    ];
  }

  /**
   * Ordena las tareas por prioridad y dependencias
   */
  private sortTasksByDependencies(tasks: SyncTask[]): SyncTask[] {
    const taskMap = new Map<string, SyncTask>();
    const completed = new Set<string>();
    const sorted: SyncTask[] = [];

    // Crear mapa de tareas
    for (const task of tasks) {
      taskMap.set(task.getTableName(), task);
    }

    // Función recursiva para agregar tareas
    const addTask = (task: SyncTask): void => {
      const tableName = task.getTableName();
      
      if (completed.has(tableName)) {
        return;
      }

      // Primero agregar dependencias
      for (const dep of task.getDependencies()) {
        const depTask = taskMap.get(dep);
        if (depTask && !completed.has(dep)) {
          addTask(depTask);
        }
      }

      // Luego agregar la tarea actual
      sorted.push(task);
      completed.add(tableName);
    };

    // Ordenar por prioridad inicial
    const tasksByPriority = [...tasks].sort((a, b) => a.getPriority() - b.getPriority());

    // Construir orden final con dependencias
    for (const task of tasksByPriority) {
      addTask(task);
    }

    return sorted;
  }

  /**
   * Ejecuta todas las tareas de sincronización
   */
  async executeAll(): Promise<{
    success: boolean;
    results: Map<string, SyncTaskResult>;
    errors: string[];
  }> {
    const tasks = this.createAllTasks();
    const sortedTasks = this.sortTasksByDependencies(tasks);
    const results = new Map<string, SyncTaskResult>();
    const errors: string[] = [];

    console.log(`[SyncOrchestrator] Iniciando sincronización de ${sortedTasks.length} tareas`);
    console.log(`[SyncOrchestrator] Orden de ejecución:`, sortedTasks.map(t => t.getTableName()));

    let current = 0;
    const total = sortedTasks.length;

    for (const task of sortedTasks) {
      current++;

      // Notificar progreso
      if (this.onProgress) {
        this.onProgress({
          current,
          total,
          entity: task.getTableName(),
          status: 'syncing',
          message: `Sincronizando ${task.getTableName()}...`,
        });
      }

      try {
        console.log(`[SyncOrchestrator] Ejecutando tarea: ${task.getTableName()}`);
        
        const result = await task.executeWithLogging();
        results.set(task.getTableName(), result);

        if (!result.success) {
          errors.push(`${task.getTableName()}: ${result.error || 'Error desconocido'}`);
          console.error(`[SyncOrchestrator] Error en ${task.getTableName()}:`, result.error);
        } else {
          console.log(`[SyncOrchestrator] Tarea ${task.getTableName()} completada exitosamente`);
        }

        // Notificar estado final de esta tarea
        if (this.onProgress) {
          this.onProgress({
            current,
            total,
            entity: task.getTableName(),
            status: result.success ? 'success' : 'error',
            message: result.success 
              ? `${task.getTableName()} sincronizado` 
              : `Error en ${task.getTableName()}: ${result.error || 'Error desconocido'}`,
          });
        }
      } catch (error) {
        const errorResult: SyncTaskResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Error desconocido',
        };
        
        results.set(task.getTableName(), errorResult);
        errors.push(`${task.getTableName()}: ${errorResult.error}`);
        
        console.error(`[SyncOrchestrator] Error crítico en ${task.getTableName()}:`, error);

        // Notificar error
        if (this.onProgress) {
          this.onProgress({
            current,
            total,
            entity: task.getTableName(),
            status: 'error',
            message: `Error crítico en ${task.getTableName()}: ${errorResult.error}`,
          });
        }
      }

      // Pequeña pausa entre tareas para no sobrecargar la API
      await new Promise<void>(resolve => setTimeout(() => resolve(), 100));
    }

    const success = errors.length === 0;
    
    console.log(`[SyncOrchestrator] Sincronización completada. Éxito: ${success}, Errores: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log(`[SyncOrchestrator] Resumen de errores:`, errors);
    }

    return {
      success,
      results,
      errors,
    };
  }

  /**
   * Ejecuta una tarea específica
   */
  async executeTask(tableName: string): Promise<SyncTaskResult | null> {
    const tasks = this.createAllTasks();
    const task = tasks.find(t => t.getTableName() === tableName);
    
    if (!task) {
      console.error(`[SyncOrchestrator] Tarea no encontrada: ${tableName}`);
      return null;
    }

    console.log(`[SyncOrchestrator] Ejecutando tarea individual: ${tableName}`);
    
    // Notificar progreso
    if (this.onProgress) {
      this.onProgress({
        current: 1,
        total: 1,
        entity: tableName,
        status: 'syncing',
        message: `Sincronizando ${tableName}...`,
      });
    }

    const result = await task.executeWithLogging();

    // Notificar estado final
    if (this.onProgress) {
      this.onProgress({
        current: 1,
        total: 1,
        entity: tableName,
        status: result.success ? 'success' : 'error',
        message: result.success 
          ? `${tableName} sincronizado` 
          : `Error en ${tableName}: ${result.error || 'Error desconocido'}`,
      });
    }

    return result;
  }
}
