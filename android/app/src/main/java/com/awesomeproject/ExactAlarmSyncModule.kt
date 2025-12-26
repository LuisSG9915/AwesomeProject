package com.awesomeproject

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Módulo nativo para sincronización forzada cada minuto usando AlarmManager.
 * 
 * IMPORTANTE: Esto ignora las políticas de ahorro de batería de Android.
 * Requiere permisos SCHEDULE_EXACT_ALARM y USE_EXACT_ALARM en AndroidManifest.xml
 */
class ExactAlarmSyncModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "ExactAlarmSync"
        private const val ALARM_ACTION = "com.awesomeproject.EXACT_SYNC_ALARM"
        private const val SYNC_INTERVAL_MS = 60 * 1000L // 1 minuto
    }

    override fun getName(): String = "ExactAlarmSync"

    /**
     * Inicia las alarmas exactas cada minuto
     */
    @ReactMethod
    fun startExactAlarms(promise: Promise) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            // Verificar si podemos usar alarmas exactas
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (!alarmManager.canScheduleExactAlarms()) {
                    Log.e(TAG, "No se pueden programar alarmas exactas. Usuario debe habilitar en configuración.")
                    promise.reject("PERMISSION_DENIED", "Se requiere permiso para alarmas exactas")
                    return
                }
            }

            // Crear PendingIntent para el BroadcastReceiver
            val intent = Intent(context, SyncAlarmReceiver::class.java).apply {
                action = ALARM_ACTION
            }
            
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // Cancelar alarmas previas
            alarmManager.cancel(pendingIntent)

            // Programar alarma exacta repetitiva cada minuto
            val triggerTime = SystemClock.elapsedRealtime() + SYNC_INTERVAL_MS

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                // Android 6.0+ - Usar setExactAndAllowWhileIdle para ignorar Doze
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    triggerTime,
                    pendingIntent
                )
            } else {
                // Android < 6.0
                alarmManager.setExact(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    triggerTime,
                    pendingIntent
                )
            }

            Log.d(TAG, "✅ Alarma exacta programada para dentro de ${SYNC_INTERVAL_MS / 1000}s")
            promise.resolve("Alarmas exactas iniciadas")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error iniciando alarmas exactas", e)
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * Detiene las alarmas exactas
     */
    @ReactMethod
    fun stopExactAlarms(promise: Promise) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            val intent = Intent(context, SyncAlarmReceiver::class.java).apply {
                action = ALARM_ACTION
            }
            
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            alarmManager.cancel(pendingIntent)
            Log.d(TAG, "🛑 Alarmas exactas detenidas")
            promise.resolve("Alarmas exactas detenidas")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error deteniendo alarmas exactas", e)
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * Verifica si se pueden programar alarmas exactas
     */
    @ReactMethod
    fun canScheduleExactAlarms(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val alarmManager = reactApplicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
                val canSchedule = alarmManager.canScheduleExactAlarms()
                promise.resolve(canSchedule)
            } else {
                // Android < 12 siempre puede programar alarmas exactas
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * Emite evento a JavaScript cuando se dispara la alarma
     */
    fun emitSyncEvent() {
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onExactAlarmSync", null)
        } catch (e: Exception) {
            Log.e(TAG, "Error emitiendo evento de sync", e)
        }
    }
}

/**
 * BroadcastReceiver que se ejecuta cuando se dispara la alarma
 */
class SyncAlarmReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "SyncAlarmReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val timestamp = System.currentTimeMillis()
        val timeString = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date(timestamp))
        
        Log.d(TAG, "═══════════════════════════════════════════════════════")
        Log.d(TAG, "⏰ ALARMA RECIBIDA - $timeString")
        Log.d(TAG, "═══════════════════════════════════════════════════════")

        try {
            // Re-programar la siguiente alarma PRIMERO (porque setExactAndAllowWhileIdle no es repetitiva)
            scheduleNextAlarm(context)

            // Disparar HeadlessTask propio de ExactAlarmSync
            Log.d(TAG, "🚀 Iniciando HeadlessTask 'ExactAlarmSync'...")
            val headlessIntent = Intent(context, ExactAlarmSyncService::class.java)
            context.startService(headlessIntent)

            Log.d(TAG, "✅ HeadlessTask iniciado exitosamente")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error en onReceive", e)
            Log.e(TAG, "Error detalle: ${e.message}")
            Log.e(TAG, "Stack trace: ${e.stackTraceToString()}")
        }
    }

    private fun scheduleNextAlarm(context: Context) {
        try {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            
            val intent = Intent(context, SyncAlarmReceiver::class.java).apply {
                action = "com.awesomeproject.EXACT_SYNC_ALARM"
            }
            
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val triggerTime = SystemClock.elapsedRealtime() + 60 * 1000L // 1 minuto
            val triggerTimeDate = System.currentTimeMillis() + 60 * 1000L
            val nextTimeString = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date(triggerTimeDate))

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    triggerTime,
                    pendingIntent
                )
            } else {
                alarmManager.setExact(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    triggerTime,
                    pendingIntent
                )
            }

            Log.d(TAG, "⏰ Próxima alarma programada para: $nextTimeString (en 60s)")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error programando próxima alarma", e)
            Log.e(TAG, "Error detalle: ${e.message}")
        }
    }
}
