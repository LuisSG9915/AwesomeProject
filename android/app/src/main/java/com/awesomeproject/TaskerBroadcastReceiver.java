package com.awesomeproject;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import com.facebook.react.HeadlessJsTaskService;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class TaskerBroadcastReceiver extends BroadcastReceiver {
    private static final String TAG = "TaskerBroadcastReceiver";
    private static int broadcastCount = 0;
    
    @Override
    public void onReceive(Context context, Intent intent) {
        broadcastCount++;
        String timestamp = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        String action = intent != null ? intent.getAction() : "null";
        
        Log.d(TAG, "═══════════════════════════════════════════════════════");
        Log.d(TAG, "📡 BROADCAST #" + broadcastCount + " RECIBIDO - " + timestamp);
        Log.d(TAG, "📋 Action: " + action);
        Log.d(TAG, "📱 Android API: " + Build.VERSION.SDK_INT);
        Log.d(TAG, "═══════════════════════════════════════════════════════");
        
        // Cuando Tasker grita "SYNC_DATOS", este código despierta el servicio
        Intent serviceIntent = new Intent(context, TaskerHeadlessService.class);
        
        try {
            // Adquirir wake lock PRIMERO para asegurar que el dispositivo no se duerma
            // Esto es crítico para Samsung/One UI que es muy agresivo matando procesos
            Log.d(TAG, "🔒 Adquiriendo wake lock...");
            HeadlessJsTaskService.acquireWakeLockNow(context);
            Log.d(TAG, "✅ Wake lock adquirido exitosamente");
            
            // En Android 8+ (API 26+) necesitamos usar startForegroundService
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Log.d(TAG, "🚀 Iniciando servicio en foreground (Android " + Build.VERSION.SDK_INT + ")");
                context.startForegroundService(serviceIntent);
            } else {
                Log.d(TAG, "🚀 Iniciando servicio normal (Android < 8)");
                context.startService(serviceIntent);
            }
            
            Log.d(TAG, "✅ Servicio iniciado correctamente");
        } catch (IllegalStateException e) {
            // Este error ocurre en Android 12+ si hay restricciones de background
            Log.e(TAG, "❌ IllegalStateException - Restricción de background: " + e.getMessage());
            Log.e(TAG, "💡 Sugerencia: Verificar que la app no esté en 'Sleeping apps' de Samsung");
        } catch (SecurityException e) {
            Log.e(TAG, "❌ SecurityException - Falta permiso: " + e.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "❌ Error inesperado al iniciar servicio: " + e.getMessage(), e);
        }
    }
}