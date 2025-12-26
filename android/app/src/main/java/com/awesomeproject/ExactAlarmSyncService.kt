package com.awesomeproject

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Servicio que ejecuta el HeadlessTask de sincronización
 */
class ExactAlarmSyncService : HeadlessJsTaskService() {
    companion object {
        private const val TAG = "ExactAlarmSyncService"
    }

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig {
        Log.d(TAG, "📋 Configurando HeadlessTask 'ExactAlarmSync'")
        
        return HeadlessJsTaskConfig(
            "ExactAlarmSync",  // Nombre del task registrado en index.js
            Arguments.createMap(),  // Datos para pasar al task
            60000,  // Timeout: 1 minuto (60 segundos)
            true  // Permitir en foreground
        )
    }
}
