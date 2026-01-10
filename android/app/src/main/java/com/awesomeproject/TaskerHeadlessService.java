package com.awesomeproject;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.facebook.react.HeadlessJsTaskService;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;
import javax.annotation.Nullable;
import java.util.Date;
import java.util.Locale;

public class TaskerHeadlessService extends HeadlessJsTaskService {
    private static final String TAG = "TaskerHeadlessService";
    private static final String CHANNEL_ID = "tasker_sync_channel";
    private static final int NOTIFICATION_ID = 9999;
    private PowerManager.WakeLock wakeLock = null;
    private WifiManager.WifiLock wifiLock = null;

    @Override
    public void onCreate() {
        super.onCreate();
        String timestamp = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        Log.d(TAG, "═══════════════════════════════════════════════════════");
        Log.d(TAG, "🚀 SERVICIO CREADO - " + timestamp);
        Log.d(TAG, "═══════════════════════════════════════════════════════");
        
        // Adquirir locks con tiempo suficiente (10 minutos) para evitar que mueran a mitad de sync
        acquireLocks(600000); 
        
        // En Android 8+ necesitamos mostrar una notificación para servicios foreground
        // CRÍTICO: Esto debe hacerse INMEDIATAMENTE para evitar que Android mate el servicio
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                createNotificationChannel();
                Notification notification = createNotification();
                
                // CRÍTICO: En Android 14+ (API 34+) es OBLIGATORIO especificar el tipo de servicio
                if (Build.VERSION.SDK_INT >= 34) { 
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
                } else {
                    startForeground(NOTIFICATION_ID, notification);
                }
                Log.d(TAG, "✅ Notificación foreground iniciada exitosamente (con tipo dataSync)");
            } catch (Exception e) {
                Log.e(TAG, "❌ Error al iniciar foreground service: " + e.getMessage(), e);
            }
        }
        
        // HEARTBEAT NATIVO: Timer para monitorear si el servicio Java sigue vivo
        startNativeHeartbeat();
    }

    @Override
    protected @Nullable HeadlessJsTaskConfig getTaskConfig(Intent intent) {
        String timestamp = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        Log.d(TAG, "⚙️ Configurando tarea headless - " + timestamp);
        Log.d(TAG, "📋 Intent action: " + (intent != null ? intent.getAction() : "null"));
        
        // CRÍTICO: Re-adquirir locks en CADA llamada con 10 min de margen
        acquireLocks(600000);
        
        // "TaskerSync" debe coincidir EXACTAMENTE con el nombre en index.js
        return new HeadlessJsTaskConfig(
            "TaskerSync",
            Arguments.createMap(),
            300000, // Timeout aumentado a 5 minutos (coincide con el mutex de JS)
            true // Permitir en primer plano (foreground) también
        );
    }
    
    private void acquireLocks(long timeout) {
        // Re-adquirir WakeLock
        try {
            if (wakeLock == null) {
                PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (powerManager != null) {
                    wakeLock = powerManager.newWakeLock(
                        PowerManager.PARTIAL_WAKE_LOCK,
                        "AwesomeProject:TaskerSyncWakeLock"
                    );
                    wakeLock.setReferenceCounted(false); // Evitar problemas de conteo
                }
            }
            
            if (wakeLock != null) {
                wakeLock.acquire(timeout); 
                Log.d(TAG, "🔒 WakeLock adquirido/renovado por " + (timeout/1000) + "s");
            }
        } catch (Exception e) {
            Log.w(TAG, "⚠️ Error adquiriendo WakeLock: " + e.getMessage());
        }
        
        // Re-adquirir WifiLock
        try {
            if (wifiLock == null) {
                WifiManager wifiManager = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wifiManager != null) {
                    wifiLock = wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "AwesomeProject:TaskerSyncWifiLock");
                    wifiLock.setReferenceCounted(false);
                }
            }
            
            if (wifiLock != null) {
                wifiLock.acquire(); // WifiLock no suele tener timeout, se libera en onDestroy
                Log.d(TAG, "📶 WifiLock adquirido/renovado");
            }
        } catch (Exception e) {
            Log.w(TAG, "⚠️ Error adquiriendo WifiLock: " + e.getMessage());
        }
    }

    @Override
    public void onDestroy() {
        String timestamp = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        Log.d(TAG, "═══════════════════════════════════════════════════════");
        Log.d(TAG, "🛑 SERVICIO DESTRUIDO - " + timestamp);
        Log.d(TAG, "═══════════════════════════════════════════════════════");
        
        stopNativeHeartbeat();
        
        // Liberar WifiLock si existe
        if (wifiLock != null && wifiLock.isHeld()) {
            try {
                wifiLock.release();
                Log.d(TAG, "📶 WifiLock liberado");
            } catch (Exception e) {
                Log.w(TAG, "⚠️ Error liberando WifiLock: " + e.getMessage());
            }
        }
        
        // Liberar WakeLock si existe
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
                Log.d(TAG, "🔓 WakeLock liberado");
            } catch (Exception e) {
                Log.w(TAG, "⚠️ Error liberando WakeLock: " + e.getMessage());
            }
        }
        
        super.onDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Sincronización Tasker",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Sincronización automática en segundo plano");
            channel.setShowBadge(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
                Log.d(TAG, " Canal de notificación creado");
            }
        }
    }

    private Notification createNotification() {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Sincronizando datos")
            .setContentText("Sincronización automática en progreso...")
            .setSmallIcon(android.R.drawable.ic_popup_sync)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setOngoing(true)
            .setAutoCancel(false);
        
        return builder.build();
    }

    private void startNativeHeartbeat() {
        if (heartbeatTimer != null) return;
        heartbeatTimer = new java.util.Timer();
        heartbeatTimer.scheduleAtFixedRate(new java.util.TimerTask() {
            @Override
            public void run() {
                Log.d(TAG, "💓 NATIVE HEARTBEAT - Servicio Java sigue vivo");
            }
        }, 10000, 10000); // Cada 10 segundos
    }

    private void stopNativeHeartbeat() {
        if (heartbeatTimer != null) {
            heartbeatTimer.cancel();
            heartbeatTimer = null;
        }
    }
}