import {
  Platform,
  AppState,
  AppStateStatus,
  NativeModules,
} from 'react-native';

const { TaskerWakeUpModule } = NativeModules;
// Usar la acción NATIVA de Tasker para ejecutar tareas directamente
const TASKER_ACTION = 'net.dinglisch.android.tasker.ACTION_TASK';
const TASKER_TASK_NAME = 'Keepalive'; // Nombre EXACTO de la tarea en Tasker (sensible a mayúsculas)

class TaskerWakeUpService {
  private appStateSubscription: any = null;
  private lastWakeUpTime: number = 0;
  private readonly WAKE_UP_COOLDOWN = 10000; // 30 segundos entre intentos (evita loops)

  /**
   * Inicializa el servicio de despertar Tasker
   * Debe llamarse al inicio de la aplicación
   */
  initialize(): void {
    console.log('[TaskerWakeUp] ═══════════════════════════════════════════');
    console.log('[TaskerWakeUp] 🚀 INICIALIZANDO SERVICIO DESPERTAR TASKER');
    console.log('[TaskerWakeUp] ═══════════════════════════════════════════');

    if (Platform.OS !== 'android') {
      console.log('[TaskerWakeUp] ⚠️ No es Android, servicio deshabilitado');
      return;
    }

    console.log('[TaskerWakeUp] ✅ Plataforma: Android');
    console.log('[TaskerWakeUp] 📡 Acción NATIVA Tasker:', TASKER_ACTION);
    console.log('[TaskerWakeUp] 🎯 Tarea a ejecutar:', TASKER_TASK_NAME);

    // Verificar que el módulo nativo esté disponible
    if (!TaskerWakeUpModule) {
      console.error(
        '[TaskerWakeUp] ❌ ERROR CRÍTICO: Módulo nativo no encontrado',
      );
      console.error(
        '[TaskerWakeUp] Verifica que TaskerWakeUpModule esté registrado en BatteryOptimizationPackage.java',
      );
      return;
    }
    console.log('[TaskerWakeUp] ✅ Módulo nativo disponible');

    // Despertar inmediatamente al iniciar la app
    console.log('[TaskerWakeUp] 📤 Enviando broadcast inicial...');
    this.wakeUpTasker('app_launch');

    // Configurar listener para cuando vuelves a la app
    // Cooldown de 30 segundos evita loops cuando Tasker se abre
    this.setupAppStateListener();
    console.log('[TaskerWakeUp] 🎧 Listener de AppState ACTIVADO');
    console.log('[TaskerWakeUp] ⏰ Cooldown: 30 segundos entre ejecuciones');
    console.log('[TaskerWakeUp] ✅ Servicio inicializado correctamente');
  }

  /**
   * Configura el listener para detectar cuando la app vuelve al foreground
   */
  private setupAppStateListener(): void {
    console.log('[TaskerWakeUp] 🎧 Configurando listener de AppState...');

    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        console.log('[TaskerWakeUp] ─────────────────────────────────────────');
        console.log(`[TaskerWakeUp] 📱 Cambio de estado: ${nextAppState}`);

        if (nextAppState === 'active') {
          console.log('[TaskerWakeUp] ✅ App volvió al FOREGROUND');
          console.log(
            '[TaskerWakeUp] 📤 Enviando broadcast de reactivación...',
          );
          this.wakeUpTasker('app_foreground');
        } else if (nextAppState === 'background') {
          console.log('[TaskerWakeUp] ⏸️ App fue a BACKGROUND');
        } else if (nextAppState === 'inactive') {
          console.log('[TaskerWakeUp] ⏸️ App está INACTIVA');
        }
        console.log('[TaskerWakeUp] ─────────────────────────────────────────');
      },
    );

    console.log('[TaskerWakeUp] ✅ Listener de AppState configurado');
  }

  /**
   * Envía el broadcast intent para despertar Tasker
   * @param source - Origen de la llamada (para logging)
   */
  private async wakeUpTasker(source: string): Promise<void> {
    console.log('[TaskerWakeUp] ╔═══════════════════════════════════════════╗');
    console.log(
      `[TaskerWakeUp] ║  DESPERTAR TASKER - Origen: ${source.padEnd(14)}║`,
    );
    console.log('[TaskerWakeUp] ╚═══════════════════════════════════════════╝');

    if (Platform.OS !== 'android') {
      console.log('[TaskerWakeUp] ⚠️ Abortando: No es Android');
      return;
    }

    // Evitar enviar múltiples broadcasts muy seguidos
    const now = Date.now();
    const timeSinceLastWake = now - this.lastWakeUpTime;

    console.log(
      `[TaskerWakeUp] ⏱️ Tiempo desde último broadcast: ${timeSinceLastWake}ms`,
    );
    console.log(
      `[TaskerWakeUp] ⏱️ Cooldown configurado: ${this.WAKE_UP_COOLDOWN}ms`,
    );

    if (now - this.lastWakeUpTime < this.WAKE_UP_COOLDOWN) {
      console.log('[TaskerWakeUp] ⏰ ⚠️ COOLDOWN ACTIVO - Esperando...');
      console.log(
        `[TaskerWakeUp] ⏰ Faltan ${
          this.WAKE_UP_COOLDOWN - timeSinceLastWake
        }ms`,
      );
      return;
    }

    try {
      console.log('[TaskerWakeUp] 🔍 Verificando módulo nativo...');

      if (!TaskerWakeUpModule) {
        console.error(
          '[TaskerWakeUp] ❌ ERROR CRÍTICO: Módulo nativo no disponible',
        );
        console.error('[TaskerWakeUp] ❌ TaskerWakeUpModule es undefined/null');
        return;
      }

      console.log('[TaskerWakeUp] ✅ Módulo nativo OK');
      console.log('[TaskerWakeUp] ☢️ Usando ESTRATEGIA NUCLEAR');
      console.log(`[TaskerWakeUp] 🎯 Tarea: ${TASKER_TASK_NAME}`);
      console.log(
        `[TaskerWakeUp] 📦 Extras: source="${source}", timestamp="${now}"`,
      );
      console.log(
        '[TaskerWakeUp] 💡 Si Tasker está cerrado, se abrirá brevemente',
      );

      // Usar estrategia NUCLEAR: abre Tasker si está muerto
      const startTime = Date.now();
      console.log('[TaskerWakeUp] 🚀 Lanzando estrategia nuclear...');

      await TaskerWakeUpModule.wakeUpTaskerNuclear({
        task_name: TASKER_TASK_NAME,
        source: source,
        timestamp: now.toString(),
        app: 'AwesomeApp',
      });

      const duration = Date.now() - startTime;
      this.lastWakeUpTime = now;

      console.log(
        `[TaskerWakeUp] ✅ ¡Broadcast enviado exitosamente! (${duration}ms)`,
      );
      console.log(`[TaskerWakeUp] ⚡ Tasker debería ejecutar la tarea ahora`);
      console.log(`[TaskerWakeUp] 📡 Action enviada: ${TASKER_ACTION}`);
      console.log(`[TaskerWakeUp] 🎯 Tarea: ${TASKER_TASK_NAME}`);
      console.log(`[TaskerWakeUp] 📍 Origen: ${source}`);
      console.log('[TaskerWakeUp] ═══════════════════════════════════════════');
    } catch (error) {
      console.error(
        '[TaskerWakeUp] ╔═══════════════════════════════════════════╗',
      );
      console.error(
        '[TaskerWakeUp] ║         ❌ ERROR AL ENVIAR BROADCAST     ║',
      );
      console.error(
        '[TaskerWakeUp] ╚═══════════════════════════════════════════╝',
      );
      console.error('[TaskerWakeUp] Detalles del error:', error);
      console.error('[TaskerWakeUp] Tipo de error:', typeof error);
      console.error(
        '[TaskerWakeUp] Error.message:',
        error instanceof Error ? error.message : 'N/A',
      );
      console.error(
        '[TaskerWakeUp] Error.stack:',
        error instanceof Error ? error.stack : 'N/A',
      );
      console.error(
        '[TaskerWakeUp] ═══════════════════════════════════════════',
      );
    }
  }

  /**
   * Forzar un despertar manual de Tasker
   * Útil para testing o situaciones especiales
   */
  forceWakeUp(): void {
    console.log('[TaskerWakeUp] 🔧 Despertar manual forzado');
    this.lastWakeUpTime = 0; // Reset cooldown
    this.wakeUpTasker('manual_force');
  }

  /**
   * Limpia los listeners al destruir el servicio
   */
  cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
      console.log('[TaskerWakeUp] 🧹 Listeners limpiados');
    }
  }

  /**
   * Obtiene el nombre de la acción configurada
   * Útil para mostrar al usuario qué configurar en Tasker
   */
  getTaskerAction(): string {
    return TASKER_ACTION;
  }

  /**
   * Obtiene el nombre de la tarea configurada
   */
  getTaskerTaskName(): string {
    return TASKER_TASK_NAME;
  }

  /**
   * Devuelve instrucciones para configurar Tasker
   */
  getTaskerInstructions(): string {
    return `
═══════════════════════════════════════════
  CONFIGURACIÓN DE TASKER
═══════════════════════════════════════════

📋 PASO 1: Crear Tarea en Tasker

1. Abre Tasker
2. Ve a la pestaña "Tareas" (Tasks)
3. Toca el botón + para crear una nueva tarea
4. Nómbrala exactamente: "${TASKER_TASK_NAME}"
5. Dentro de la tarea, agrega acciones:
   - Tasker -> Establecer Variable
   - Variable: %TaskerStatus
   - A: Running
   - (Opcional) Alerta -> Flash -> "Tasker Despierto"

⚠️ IMPORTANTE: El nombre debe ser EXACTAMENTE "${TASKER_TASK_NAME}"
sin espacios extras ni mayúsculas/minúsculas diferentes.

📋 PASO 2: Permisos de Tasker

1. Preferencias -> Misceláneo
   - ✅ Allow External Access (activar)

2. Preferencias -> Monitor
   - ✅ Run In Foreground (activar)
   - ✅ Use Reliable Alarms: "Always"

📋 PASO 3: Configuración del Sistema

1. Ajustes -> Batería
   - Tasker: Sin restricciones
   - AwesomeApp: Sin restricciones

2. Ajustes -> Aplicaciones
   - Inicio Automático: Activado para Tasker

═══════════════════════════════════════════
  ✅ LISTO
═══════════════════════════════════════════

Cada vez que abras esta app, se ejecutará
automáticamente la tarea "${TASKER_TASK_NAME}" en Tasker.

Acción nativa: ${TASKER_ACTION}
Tarea: ${TASKER_TASK_NAME}
`;
  }
}

export default new TaskerWakeUpService();
