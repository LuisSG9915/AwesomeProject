/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import BackgroundFetch from 'react-native-background-fetch';

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerHeadlessTask('TaskerSync', () => require('./services/TaskerSyncService'));
/**
 * HeadlessTask para sincronización en segundo plano (BackgroundFetch)
 * Se ejecuta como respaldo cada ~15 minutos cuando la app está cerrada
 * 
 * NOTA: El servicio principal de sincronización es PersistentSyncService
 * que usa react-native-background-actions (Foreground Service).
 * Este HeadlessTask actúa como respaldo si el Foreground Service se detiene.
 */
const HeadlessTask = async (event) => {
  const taskId = event.taskId;
  const isTimeout = event.timeout;

  if (isTimeout) {
    console.log('[HeadlessTask] Timeout:', taskId);
    BackgroundFetch.finish(taskId);
    return;
  }

  console.log('[HeadlessTask] Ejecutando sincronización de respaldo:', taskId);

  try {
    // Importar dinámicamente los servicios necesarios
    const FullSyncService = require('./services/FullSyncService').default;
    const AuthService = require('./services/AuthService').default;

    // Obtener sesión del usuario
    const user = await AuthService.restoreSession();
    
    if (!user) {
      console.log('[HeadlessTask] No hay sesión activa, omitiendo sincronización');
      BackgroundFetch.finish(taskId);
      return;
    }

    const sucursal = user.sucursal_origen || user.sucursal || 1;
    const idUsuario = user.id || user.idUsuario || 1;
    console.log('[HeadlessTask] Sincronizando sucursal:', sucursal);
    
    // Primero enviar ventas pendientes
    const ventasResult = await FullSyncService.sendPendingVentasToServer(
      sucursal,
      idUsuario,
    );
    if (ventasResult.success && ventasResult.sent > 0) {
      console.log(`[HeadlessTask] Ventas pendientes enviadas: ${ventasResult.sent}`);
    }
    
    // Ejecutar sincronización incremental (más ligera que syncAll)
    const result = await FullSyncService.syncIncremental(sucursal, (progress) => {
      console.log('[HeadlessTask] Progreso:', progress.entity, progress.status);
    });
    
    if (result.success) {
      console.log('[HeadlessTask] Sincronización completada exitosamente');
    } else {
      console.log('[HeadlessTask] Sincronización completada con errores:', result.error);
    }
  } catch (error) {
    console.error('[HeadlessTask] Error crítico:', error);
  }

  // IMPORTANTE: Siempre llamar finish()
  BackgroundFetch.finish(taskId);
};

// Registrar la tarea headless (DEBE estar a nivel superior, fuera de cualquier componente)
BackgroundFetch.registerHeadlessTask(HeadlessTask);
