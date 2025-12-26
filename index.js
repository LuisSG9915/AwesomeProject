/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import BackgroundFetch from 'react-native-background-fetch';

AppRegistry.registerComponent(appName, () => App);

/**
 * HeadlessTask para alarmas exactas (cada minuto)
 * Se ejecuta cuando SyncAlarmReceiver dispara la alarma
 */
const ExactAlarmHeadlessTask = async (taskData) => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('[ExactAlarmHeadless] 🚀 INICIANDO SINCRONIZACIÓN');
  console.log('[ExactAlarmHeadless] Timestamp:', new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════');

  try {
    // Importar dinámicamente los servicios necesarios
    const FullSyncService = require('./services/FullSyncService').default;
    const AuthService = require('./services/AuthService').default;

    // Obtener sesión del usuario
    const user = await AuthService.restoreSession();
    
    if (!user) {
      console.log('[ExactAlarmHeadless] ❌ No hay sesión activa, omitiendo sincronización');
      return;
    }

    const sucursal = user.sucursal_origen || user.sucursal || 1;
    const idUsuario = user.id || user.idUsuario || 1;
    console.log('[ExactAlarmHeadless] 👤 Usuario:', user.claveEmpleado || idUsuario);
    console.log('[ExactAlarmHeadless] 🏢 Sucursal:', sucursal);
    
    // PASO 1: Enviar ventas pendientes (NO CANCELAR si falla)
    console.log('[ExactAlarmHeadless] 📤 PASO 1: Enviando ventas pendientes...');
    try {
      const ventasResult = await FullSyncService.sendPendingVentasToServer(
        sucursal,
        idUsuario,
      );
      if (ventasResult.success && ventasResult.sent > 0) {
        console.log(`[ExactAlarmHeadless] ✅ Ventas enviadas: ${ventasResult.sent}`);
      } else if (ventasResult.success) {
        console.log('[ExactAlarmHeadless] ℹ️ No hay ventas pendientes');
      } else {
        console.warn('[ExactAlarmHeadless] ⚠️ Error enviando ventas:', ventasResult.error);
      }
    } catch (ventasError) {
      console.error('[ExactAlarmHeadless] ❌ Error en arrastre de ventas (continuando):', ventasError?.message);
    }
    
    // PASO 2: Enviar cobranza pendiente (NO CANCELAR si falla)
    console.log('[ExactAlarmHeadless] 📤 PASO 2: Enviando cobranza pendiente...');
    try {
      const cobranzaResult = await FullSyncService.sendPendingCobranzaToServer(
        sucursal,
        idUsuario,
      );
      if (cobranzaResult.success && cobranzaResult.sent > 0) {
        console.log(`[ExactAlarmHeadless] ✅ Cobranza enviada: ${cobranzaResult.sent}`);
      } else if (cobranzaResult.success) {
        console.log('[ExactAlarmHeadless] ℹ️ No hay cobranza pendiente');
      } else {
        console.warn('[ExactAlarmHeadless] ⚠️ Error enviando cobranza:', cobranzaResult.error);
      }
    } catch (cobranzaError) {
      console.error('[ExactAlarmHeadless] ❌ Error en arrastre de cobranza (continuando):', cobranzaError?.message);
    }
    
    // PASO 3: Sincronización incremental
    console.log('[ExactAlarmHeadless] 🔄 PASO 3: Sincronización incremental...');
    console.log('[ExactAlarmHeadless] 🔄 Llamando a FullSyncService.syncIncremental()...');
    
    const result = await FullSyncService.syncIncremental(sucursal, (progress) => {
      console.log(`[ExactAlarmHeadless] 📊 ${progress.entity}: ${progress.status} (${progress.current}/${progress.total})`);
    });
    
    console.log('[ExactAlarmHeadless] 🔄 syncIncremental() completado, procesando resultado...');
    
    if (result.success) {
      console.log('[ExactAlarmHeadless] ✅ Sincronización completada exitosamente');
      console.log('[ExactAlarmHeadless] 📊 Tablas sincronizadas:', result.syncedTables || 'N/A');
    } else {
      console.log('[ExactAlarmHeadless] ❌ Sincronización con errores:', result.error);
      console.log('[ExactAlarmHeadless] 📊 Detalles del error:', JSON.stringify(result));
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('[ExactAlarmHeadless] ✅ PROCESO COMPLETADO');
    console.log('═══════════════════════════════════════════════════════');
  } catch (error) {
    console.error('[ExactAlarmHeadless] ❌ Error crítico:', error);
    console.error('[ExactAlarmHeadless] Error detalle:', error?.message);
    console.error('[ExactAlarmHeadless] Stack:', error?.stack);
  }
};

// Registrar HeadlessTask para alarmas exactas
AppRegistry.registerHeadlessTask('ExactAlarmSync', () => ExactAlarmHeadlessTask);

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
