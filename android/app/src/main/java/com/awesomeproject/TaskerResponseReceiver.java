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
        responseListener = listener;
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
            
            if (responseListener != null && requestId != null) {
                Log.d(TAG, "📢 Notificando al listener...");
                responseListener.onTaskerResponse(requestId, status);
            } else {
                if (responseListener == null) {
                    Log.w(TAG, "⚠️ No hay listener registrado");
                }
                if (requestId == null) {
                    Log.w(TAG, "⚠️ Request ID es null");
                }
            }
        } else {
            Log.w(TAG, "⚠️ Action desconocida: " + action);
        }
        
        Log.d(TAG, "═══════════════════════════════════════════════════════");
    }
}
