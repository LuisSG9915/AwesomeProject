package com.awesomeproject;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * BroadcastReceiver que escucha respuestas de Tasker
 * para verificar que está activo y procesando tareas
 */
public class TaskerResponseReceiver extends BroadcastReceiver {
    private static final String TAG = "TaskerResponseReceiver";
    
    // Listener estático para notificar al módulo
    private static ResponseListener responseListener;
    
    public interface ResponseListener {
        void onTaskerResponse(String requestId, String status);
    }
    
    public static void setResponseListener(ResponseListener listener) {
        Log.d(TAG, "╔═══════════════════════════════════════════════════════╗");
        Log.d(TAG, "║    🔧 CONFIGURANDO RESPONSE LISTENER               ║");
        Log.d(TAG, "╚═══════════════════════════════════════════════════════╝");
        Log.d(TAG, "📥 Listener recibido: " + (listener != null ? listener.getClass().getName() : "NULL"));
        
        responseListener = listener;
        
        Log.d(TAG, "✅ Listener estático configurado");
        Log.d(TAG, "🔍 Verificación: responseListener = " + (responseListener != null ? "NOT NULL" : "NULL"));
        Log.d(TAG, "═══════════════════════════════════════════════════════");
    }
    
    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "╔═══════════════════════════════════════════════════════╗");
        Log.d(TAG, "║       📥 RESPUESTA DE TASKER RECIBIDA              ║");
        Log.d(TAG, "╚═══════════════════════════════════════════════════════╝");
        
        String action = intent.getAction();
        Log.d(TAG, "📡 Action: " + action);
        
        if ("com.awesomeproject.TASKER_RESPONSE".equals(action)) {
            String requestId = intent.getStringExtra("request_id");
            String status = intent.getStringExtra("status");
            
            Log.d(TAG, "📋 Request ID: " + requestId);
            Log.d(TAG, "✅ Status: " + status);
            Log.d(TAG, "───────────────────────────────────────────────────────");
            Log.d(TAG, "🔍 VERIFICANDO LISTENER ESTÁTICO...");
            Log.d(TAG, "   responseListener = " + (responseListener != null ? "NOT NULL ✅" : "NULL ❌"));
            
            if (responseListener != null) {
                Log.d(TAG, "   Listener class: " + responseListener.getClass().getName());
            }
            
            if (responseListener != null && requestId != null) {
                Log.d(TAG, "───────────────────────────────────────────────────────");
                Log.d(TAG, "📢 Notificando al listener...");
                try {
                    responseListener.onTaskerResponse(requestId, status);
                    Log.d(TAG, "✅ Listener notificado exitosamente");
                } catch (Exception e) {
                    Log.e(TAG, "❌ Error al notificar listener: " + e.getMessage(), e);
                }
            } else {
                Log.d(TAG, "───────────────────────────────────────────────────────");
                Log.e(TAG, "❌ NO SE PUEDE NOTIFICAR AL LISTENER:");
                if (responseListener == null) {
                    Log.e(TAG, "   ❌ No hay listener registrado (responseListener == null)");
                    Log.e(TAG, "   💡 Esto significa que el listener estático se perdió");
                    Log.e(TAG, "   💡 Posible causa: R8/ProGuard ofuscó el código");
                }
                if (requestId == null) {
                    Log.e(TAG, "   ⚠️ Request ID es null");
                }
            }
        } else {
            Log.w(TAG, "⚠️ Action desconocida: " + action);
        }
        
        Log.d(TAG, "═══════════════════════════════════════════════════════");
    }
}
