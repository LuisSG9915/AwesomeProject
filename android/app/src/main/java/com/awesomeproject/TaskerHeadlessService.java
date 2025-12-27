package com.awesomeproject;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.facebook.react.HeadlessJsTaskService;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;
import javax.annotation.Nullable;

public class TaskerHeadlessService extends HeadlessJsTaskService {
    private static final String TAG = "TaskerHeadlessService";
    private static final String CHANNEL_ID = "tasker_sync_channel";
    private static final int NOTIFICATION_ID = 9999;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, " Servicio creado");
        
        // En Android 8+ necesitamos mostrar una notificación para servicios foreground
        // CRÍTICO: Esto debe hacerse INMEDIATAMENTE para evitar que Android mate el servicio
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                createNotificationChannel();
                Notification notification = createNotification();
                startForeground(NOTIFICATION_ID, notification);
                Log.d(TAG, " Notificación foreground iniciada exitosamente");
            } catch (Exception e) {
                Log.e(TAG, " Error al iniciar foreground service: " + e.getMessage(), e);
            }
        }
    }

    @Override
    protected @Nullable HeadlessJsTaskConfig getTaskConfig(Intent intent) {
        Log.d(TAG, "⚙️ Configurando tarea headless");
        // "TaskerSync" debe coincidir EXACTAMENTE con el nombre en index.js
        return new HeadlessJsTaskConfig(
            "TaskerSync",
            Arguments.createMap(),
            60000, // Timeout: 60 segundos (mayor que el timeout JS de 56s)
            true // Permitir en primer plano (foreground) también
        );
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, " Servicio destruido");
        super.onDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Sincronización Tasker",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Sincronización automática en segundo plano");
            channel.setShowBadge(false);
            
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
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setAutoCancel(false);
        
        return builder.build();
    }
}