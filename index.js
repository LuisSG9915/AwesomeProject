/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import BackgroundFetch from 'react-native-background-fetch';

AppRegistry.registerComponent(appName, () => App);

/**
 * HeadlessTask para sincronización en segundo plano
 * Se ejecuta incluso cuando la app está cerrada o la pantalla apagada
 * 
 * IMPORTANTE: Este es el ÚNICO punto de entrada para sincronización en segundo plano.
 * Usa la misma lógica que BackgroundSyncService para mantener consistencia.
 */
const HeadlessTask = async (event) => {
  const taskId = event.taskId;
  const isTimeout = event.timeout;

  if (isTimeout) {
    console.log('[HeadlessTask] Timeout:', taskId);
    BackgroundFetch.finish(taskId);
    return;
  }

  console.log('[HeadlessTask] Ejecutando sincronización en segundo plano:', taskId);

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
    console.log('[HeadlessTask] Sincronizando sucursal:', sucursal);
    
    // Ejecutar sincronización usando la arquitectura escalable
    // FullSyncService.syncAll() ya maneja:
    // - SyncLog principal
    // - SyncTableLog por tabla
    // - Retry logic
    // - Manejo de errores
    const result = await FullSyncService.syncAll(sucursal, (progress) => {
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
