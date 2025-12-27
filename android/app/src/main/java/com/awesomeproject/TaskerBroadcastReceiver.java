package com.awesomeproject;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import com.facebook.react.HeadlessJsTaskService;

public class TaskerBroadcastReceiver extends BroadcastReceiver {
    private static final String TAG = "TaskerBroadcastReceiver";
    
    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "📡 Broadcast recibido desde Tasker");
        
        // Cuando Tasker grita "SYNC_DATOS", este código despierta el servicio
        Intent serviceIntent = new Intent(context, TaskerHeadlessService.class);
        
        try {
            // En Android 8+ (API 26+) necesitamos usar startForegroundService
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Log.d(TAG, "🚀 Iniciando servicio en foreground (Android 8+)");
                context.startForegroundService(serviceIntent);
            } else {
                Log.d(TAG, "🚀 Iniciando servicio normal (Android < 8)");
                context.startService(serviceIntent);
            }
            
            // Adquirir wake lock para asegurar que el dispositivo no se duerma
            HeadlessJsTaskService.acquireWakeLockNow(context);
            Log.d(TAG, "🔒 Wake lock adquirido");
        } catch (Exception e) {
            Log.e(TAG, "❌ Error al iniciar servicio: " + e.getMessage(), e);
        }
    }
}