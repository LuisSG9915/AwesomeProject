package com.awesomeproject;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ApplicationInfo;
import android.app.ActivityManager;
import android.util.Log;
import android.os.Handler;
import android.os.Looper;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReadableMap;

import java.util.List;
import java.util.UUID;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Módulo nativo para enviar broadcast intents a Tasker
 * Esto permite "despertar" a Tasker cuando el sistema lo ha matado
 */
public class TaskerWakeUpModule extends ReactContextBaseJavaModule implements TaskerResponseReceiver.ResponseListener {
    private static final String TAG = "TaskerWakeUpModule";
    private final ReactApplicationContext reactContext;
    private static final long RESPONSE_TIMEOUT_MS = 5000; // 5 segundos
    
    // Mapa para trackear requests pendientes
    private final Map<String, PendingRequest> pendingRequests = new ConcurrentHashMap<>();
    
    private static class PendingRequest {
        String taskerPackage;
        ReadableMap extras;
        long timestamp;
        
        PendingRequest(String taskerPackage, ReadableMap extras) {
            this.taskerPackage = taskerPackage;
            this.extras = extras;
            this.timestamp = System.currentTimeMillis();
        }
    }

    public TaskerWakeUpModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
        
        // Registrar listener para respuestas de Tasker
        TaskerResponseReceiver.setResponseListener(this);
        Log.d(TAG, "✅ Listener de respuestas registrado");
    }
    
    @Override
    public void onTaskerResponse(String requestId, String status) {
        Log.d(TAG, "╔═══════════════════════════════════════════════════════╗");
        Log.d(TAG, "║    ✅ TASKER RESPONDIÓ - ESTÁ ACTIVO               ║");
        Log.d(TAG, "╚═══════════════════════════════════════════════════════╝");
        Log.d(TAG, "📋 Request ID: " + requestId);
        Log.d(TAG, "✅ Status: " + status);
        
        // Marcar request como completado
        PendingRequest request = pendingRequests.remove(requestId);
        if (request != null) {
            long responseTime = System.currentTimeMillis() - request.timestamp;
            Log.d(TAG, "⏱️ Tiempo de respuesta: " + responseTime + "ms");
            Log.d(TAG, "✅ Request marcado como completado");
        } else {
            Log.w(TAG, "⚠️ Request ID no encontrado en pendientes");
        }
        Log.d(TAG, "═══════════════════════════════════════════════════════");
    }

    @Override
    public String getName() {
        return "TaskerWakeUpModule";
    }

    /**
     * Envía un broadcast intent silencioso para despertar Tasker
     * @param action - La acción del intent (ej: "com.awesomeapp.DESPERTAR_TASKER")
     * @param extras - Datos extras opcionales para el intent
     * @param promise - Promesa para notificar éxito/error
     */
    @ReactMethod
    public void sendBroadcast(String action, ReadableMap extras, Promise promise) {
        long startTime = System.currentTimeMillis();
        
        try {
            Log.d(TAG, "╔═══════════════════════════════════════════════════════╗");
            Log.d(TAG, "║    🚀 INYECCIÓN DIRECTA DE TAREA EN TASKER          ║");
            Log.d(TAG, "╚═══════════════════════════════════════════════════════╝");
            Log.d(TAG, "⏰ Timestamp: " + System.currentTimeMillis());
            Log.d(TAG, "📋 Action recibida: " + action);
            Log.d(TAG, "───────────────────────────────────────────────────────");
            
            // CAMBIO DE ESTRATEGIA: Usar el comando nativo de Tasker
            // En lugar de una acción personalizada, usamos la acción oficial de Tasker
            String taskerAction = "net.dinglisch.android.tasker.ACTION_TASK";
            Log.d(TAG, "🔧 Usando acción NATIVA de Tasker: " + taskerAction);
            
            Intent intent = new Intent(taskerAction);
            Log.d(TAG, "✅ Intent creado con acción oficial");
            
            // CRÍTICO: Hacer el Intent EXPLÍCITO apuntando a Tasker
            // Esto es necesario para que Android no descarte el broadcast en background
            Log.d(TAG, "📦 Configurando paquete destino (Intent explícito)...");
            
            String taskerPackageMain = "net.dinglisch.android.taskerm";
            String taskerPackageAlt = "net.dinglisch.android.tasker";
            
            // ESTRATEGIA AGRESIVA:
            // Intentamos detectar, pero si falla la detección (por permisos de Android 11+),
            // asumimos que es la versión Main y forzamos el paquete de todos modos.
            // Es preferible disparar al paquete principal "a ciegas" que mandar un broadcast implícito.
            
            if (isAppInstalled(taskerPackageMain)) {
                intent.setPackage(taskerPackageMain);
                Log.d(TAG, "  ✅ Tasker detectado: " + taskerPackageMain);
            } else if (isAppInstalled(taskerPackageAlt)) {
                intent.setPackage(taskerPackageAlt);
                Log.d(TAG, "  ✅ Tasker Alternativo detectado: " + taskerPackageAlt);
            } else {
                // AQUÍ ESTÁ EL CAMBIO CLAVE:
                // En lugar de rendirnos y mandar un implícito, FORZAMOS el paquete principal.
                // Es preferible disparar al paquete principal "a ciegas" que mandar un broadcast al aire.
                Log.w(TAG, "  ⚠️ Tasker no detectado (¿Falta <queries> en Manifest?).");
                Log.w(TAG, "  🚀 Forzando envío explícito a: " + taskerPackageMain);
                Log.w(TAG, "     Si Tasker está instalado, recibirá el broadcast.");
                Log.w(TAG, "     Si no está instalado, el broadcast será descartado silenciosamente.");
                intent.setPackage(taskerPackageMain);
            }
            
            // DEFINIR QUÉ TAREA EJECUTAR
            // "task_name" es el extra OFICIAL que Tasker escucha en ACTION_TASK
            Log.d(TAG, "📦 Configurando tarea a ejecutar...");
            
            String nombreTarea;
            if (extras != null && extras.hasKey("task_name")) {
                nombreTarea = extras.getString("task_name");
                Log.d(TAG, "🎯 Tarea especificada desde extras: '" + nombreTarea + "'");
            } else {
                // Fallback: Si no se especifica nombre, usar tarea por defecto
                nombreTarea = "Keepalive";
                Log.w(TAG, "⚠️ No se especificó 'task_name' en extras");
                Log.w(TAG, "🎯 Usando tarea por defecto: '" + nombreTarea + "'");
            }
            
            // Este es el extra OFICIAL que Tasker espera según su API
            // CLAVE: "task_name" | VALOR: nombre de la tarea (ej: "KeepAlive")
            intent.putExtra("task_name", nombreTarea);
            Log.d(TAG, "✅ Extra 'task_name' = '" + nombreTarea + "' configurado");
            
            // Agregar extras adicionales para logging/debugging
            if (extras != null) {
                if (extras.hasKey("source")) {
                    String source = extras.getString("source");
                    intent.putExtra("source", source);
                    Log.d(TAG, "  ℹ️ Extra adicional 'source': " + source);
                }
                if (extras.hasKey("timestamp")) {
                    String timestamp = extras.getString("timestamp");
                    intent.putExtra("timestamp", timestamp);
                    Log.d(TAG, "  ℹ️ Extra adicional 'timestamp': " + timestamp);
                }
            }
            
            // CRÍTICO: Agregar flags para alcanzar apps detenidas
            Log.d(TAG, "🚩 Agregando flags especiales...");
            intent.addFlags(Intent.FLAG_INCLUDE_STOPPED_PACKAGES);
            Log.d(TAG, "  ✅ FLAG_INCLUDE_STOPPED_PACKAGES agregado");
            intent.addFlags(Intent.FLAG_RECEIVER_FOREGROUND);
            Log.d(TAG, "  ✅ FLAG_RECEIVER_FOREGROUND agregado");
            Log.d(TAG, "  ℹ️ Estos flags permiten que el broadcast llegue a Tasker");
            Log.d(TAG, "     incluso si Android lo ha detenido completamente");
            
            // Enviar el broadcast al sistema Android
            Log.d(TAG, "───────────────────────────────────────────────────────");
            Log.d(TAG, "📡 ENVIANDO BROADCAST AL SISTEMA ANDROID...");
            reactContext.sendBroadcast(intent);
            
            long duration = System.currentTimeMillis() - startTime;
            
            Log.d(TAG, "───────────────────────────────────────────────────────");
            Log.d(TAG, "✅ ¡BROADCAST ENVIADO EXITOSAMENTE!");
            Log.d(TAG, "⏱️ Duración: " + duration + "ms");
            Log.d(TAG, "📡 Action enviada: " + action);
            Log.d(TAG, "🎯 El sistema Android debería entregar este broadcast a:");
            Log.d(TAG, "   • Tasker (net.dinglisch.android.taskerm)");
            Log.d(TAG, "   • Cualquier BroadcastReceiver escuchando la acción");
            Log.d(TAG, "───────────────────────────────────────────────────────");
            Log.d(TAG, "💡 SIGUIENTE PASO:");
            Log.d(TAG, "   Verifica en Tasker si recibe el Intent con la acción:");
            Log.d(TAG, "   " + action);
            Log.d(TAG, "═══════════════════════════════════════════════════════");
            
            promise.resolve(true);
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            
            Log.e(TAG, "╔═══════════════════════════════════════════════════════╗");
            Log.e(TAG, "║           ❌ ERROR AL ENVIAR BROADCAST               ║");
            Log.e(TAG, "╚═══════════════════════════════════════════════════════╝");
            Log.e(TAG, "⏱️ Tiempo transcurrido: " + duration + "ms");
            Log.e(TAG, "📋 Action que se intentó enviar: " + action);
            Log.e(TAG, "❌ Tipo de excepción: " + e.getClass().getSimpleName());
            Log.e(TAG, "❌ Mensaje de error: " + e.getMessage());
            Log.e(TAG, "❌ Stack trace completo:", e);
            Log.e(TAG, "═══════════════════════════════════════════════════════");
            
            promise.reject("BROADCAST_ERROR", e.getMessage(), e);
        }
    }

    /**
     * Envía un broadcast con package explícito (más directo)
     * Útil si conoces el package de Tasker
     */
    @ReactMethod
    public void sendExplicitBroadcast(String action, String targetPackage, Promise promise) {
        try {
            Log.d(TAG, "═══════════════════════════════════════════════════════");
            Log.d(TAG, "⚡ ENVIANDO BROADCAST EXPLÍCITO");
            Log.d(TAG, "📋 Action: " + action);
            Log.d(TAG, "📦 Target Package: " + targetPackage);
            
            // Verificar si el paquete destino está instalado
            if (!isAppInstalled(targetPackage)) {
                Log.w(TAG, "⚠️ ADVERTENCIA: El paquete " + targetPackage + " no está instalado");
                Log.w(TAG, "   El broadcast se enviará pero probablemente no será recibido");
            } else {
                Log.d(TAG, "✅ Paquete destino verificado y encontrado");
            }
            
            Intent intent = new Intent(action);
            intent.setPackage(targetPackage);
            intent.addFlags(Intent.FLAG_INCLUDE_STOPPED_PACKAGES);
            intent.addFlags(Intent.FLAG_RECEIVER_FOREGROUND);
            
            Log.d(TAG, "🚩 Flags agregados:");
            Log.d(TAG, "  - FLAG_INCLUDE_STOPPED_PACKAGES");
            Log.d(TAG, "  - FLAG_RECEIVER_FOREGROUND");
            
            reactContext.sendBroadcast(intent);
            
            Log.d(TAG, "✅ Broadcast explícito enviado exitosamente");
            Log.d(TAG, "═══════════════════════════════════════════════════════");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "❌ Error enviando broadcast explícito: " + e.getMessage(), e);
            promise.reject("BROADCAST_ERROR", e.getMessage(), e);
        }
    }

    /**
     * Obtiene información sobre el estado de Tasker
     */
    @ReactMethod
    public void getTaskerStatus(Promise promise) {
        try {
            // Verificar si Tasker está instalado
            String taskerPackage = "net.dinglisch.android.taskerm"; // Tasker paid
            String taskerPackageFree = "net.dinglisch.android.tasker"; // Tasker free (si existe)
            
            boolean isInstalled = isAppInstalled(taskerPackage) || isAppInstalled(taskerPackageFree);
            
            Log.d(TAG, "📱 Tasker instalado: " + isInstalled);
            promise.resolve(isInstalled);
        } catch (Exception e) {
            Log.e(TAG, "❌ Error verificando Tasker: " + e.getMessage());
            promise.reject("ERROR", e.getMessage());
        }
    }

    /**
     * ESTRATEGIA NUCLEAR: Abre Tasker si está muerto, luego envía el broadcast
     * Esto garantiza que Tasker despierte incluso con battery optimizations agresivas
     */
    @ReactMethod
    public void wakeUpTaskerNuclear(ReadableMap extras, Promise promise) {
        Log.e(TAG, "");
        Log.e(TAG, "════════════════════════════════════════════════════════════════");
        Log.e(TAG, "☢️☢️☢️ MÉTODO wakeUpTaskerNuclear LLAMADO ☢️☢️☢️");
        Log.e(TAG, "════════════════════════════════════════════════════════════════");
        
        try {
            String taskerPackageMain = "net.dinglisch.android.taskerm";
            String taskerPackageAlt = "net.dinglisch.android.tasker";
            
            String taskerPackage = null;
            if (isAppInstalled(taskerPackageMain)) {
                taskerPackage = taskerPackageMain;
            } else if (isAppInstalled(taskerPackageAlt)) {
                taskerPackage = taskerPackageAlt;
            }
            
            if (taskerPackage == null) {
                Log.e(TAG, "❌ Tasker no está instalado");
                promise.reject("TASKER_NOT_INSTALLED", "Tasker no está instalado");
                return;
            }
            
            Log.d(TAG, "📦 Paquete de Tasker: " + taskerPackage);
            
            // Generar ID único para este request
            final String requestId = UUID.randomUUID().toString();
            Log.d(TAG, "🆔 Request ID: " + requestId);
            
            // Guardar request como pendiente
            final String finalTaskerPackage = taskerPackage;
            pendingRequests.put(requestId, new PendingRequest(taskerPackage, extras));
            Log.d(TAG, "📝 Request guardado como pendiente");
            
            // PASO 1: Enviar broadcast con verificación
            Log.d(TAG, "╔═══════════════════════════════════════════════════════╗");
            Log.d(TAG, "║  📤 ENVIAR BROADCAST Y ESPERAR RESPUESTA           ║");
            Log.d(TAG, "╚═══════════════════════════════════════════════════════╝");
            
            sendTaskBroadcastWithVerification(taskerPackage, extras, requestId);
            
            // PASO 2: Programar timeout - si no hay respuesta, abrir Tasker
            new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                @Override
                public void run() {
                    // Verificar si el request sigue pendiente
                    PendingRequest request = pendingRequests.get(requestId);
                    
                    if (request != null) {
                        // NO hubo respuesta - Tasker está muerto
                        Log.d(TAG, "╔═══════════════════════════════════════════════════════╗");
                        Log.d(TAG, "║  ⏱️ TIMEOUT - TASKER NO RESPONDIÓ                  ║");
                        Log.d(TAG, "╚═══════════════════════════════════════════════════════╝");
                        Log.w(TAG, "⚠️ No se recibió respuesta de Tasker en " + RESPONSE_TIMEOUT_MS + "ms");
                        Log.w(TAG, "☢️ Iniciando ACTIVACIÓN NUCLEAR...");
                        
                        // Remover de pendientes
                        pendingRequests.remove(requestId);
                        
                        // Abrir Tasker para revivirlo
                        Intent launchIntent = reactContext.getPackageManager()
                            .getLaunchIntentForPackage(finalTaskerPackage);
                        
                        if (launchIntent != null) {
                            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            launchIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
                            
                            try {
                                Log.d(TAG, "🚀 Abriendo Tasker para revivirlo...");
                                reactContext.startActivity(launchIntent);
                                Log.d(TAG, "✅ Tasker Activity lanzada");
                                
                                // Re-enviar broadcast después de abrirlo
                                new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                                    @Override
                                    public void run() {
                                        Log.d(TAG, "📤 Re-enviando broadcast después de revivir Tasker...");
                                        String newRequestId = UUID.randomUUID().toString();
                                        sendTaskBroadcastWithVerification(finalTaskerPackage, request.extras, newRequestId);
                                    }
                                }, 1500);
                                
                            } catch (Exception e) {
                                Log.e(TAG, "❌ Error abriendo Tasker: " + e.getMessage());
                            }
                        } else {
                            Log.e(TAG, "❌ No se pudo obtener intent para Tasker");
                        }
                    } else {
                        // Hubo respuesta - Tasker está activo
                        Log.d(TAG, "✅ Tasker respondió a tiempo - está ACTIVO");
                    }
                }
            }, RESPONSE_TIMEOUT_MS);
            
            Log.d(TAG, "✅ Broadcast enviado, esperando respuesta...");
            promise.resolve(true);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error: " + e.getMessage(), e);
            promise.reject("NUCLEAR_ERROR", e.getMessage(), e);
        }
    }
    
    /**
     * Envía el broadcast de tarea a Tasker CON verificación de respuesta
     * Usa Intent personalizado para que Tasker reciba los extras como variables
     */
    private void sendTaskBroadcastWithVerification(String taskerPackage, ReadableMap extras, String requestId) {
        try {
            Log.d(TAG, "╔═══════════════════════════════════════════════════════╗");
            Log.d(TAG, "║    📤 ENVIANDO BROADCAST CON VERIFICACIÓN          ║");
            Log.d(TAG, "╚═══════════════════════════════════════════════════════╝");
            
            // Usar Intent personalizado en lugar de ACTION_TASK
            // Esto permite que Tasker reciba los extras como variables (%request_id, etc.)
            String customAction = "com.awesomeproject.VERIFY_TASKER";
            Log.d(TAG, "📡 Acción: " + customAction);
            Log.d(TAG, "📦 Paquete destino: " + taskerPackage);
            Log.d(TAG, "🆔 Request ID: " + requestId);
            
            Intent intent = new Intent(customAction);
            intent.setPackage(taskerPackage);
            
            // Agregar extras que Tasker convertirá en variables automáticamente
            intent.putExtra("request_id", requestId);
            Log.d(TAG, "🆔 Request ID incluido en broadcast");
            
            // Agregar extras adicionales
            if (extras != null) {
                if (extras.hasKey("task_name")) {
                    String taskName = extras.getString("task_name");
                    intent.putExtra("task_name", taskName);
                    Log.d(TAG, "🎯 Tarea: '" + taskName + "'");
                }
                if (extras.hasKey("source")) {
                    String source = extras.getString("source");
                    intent.putExtra("source", source);
                    Log.d(TAG, "📍 Source: " + source);
                }
                if (extras.hasKey("timestamp")) {
                    String timestamp = extras.getString("timestamp");
                    intent.putExtra("timestamp", timestamp);
                    Log.d(TAG, "🕐 Timestamp: " + timestamp);
                }
            }
            
            intent.addFlags(Intent.FLAG_INCLUDE_STOPPED_PACKAGES);
            intent.addFlags(Intent.FLAG_RECEIVER_FOREGROUND);
            
            reactContext.sendBroadcast(intent);
            
            Log.d(TAG, "✅ Broadcast enviado con extras");
            Log.d(TAG, "⏱️ Esperando respuesta de Tasker...");
            Log.d(TAG, "💡 Tasker convertirá los extras en variables automáticamente");
            Log.d(TAG, "═══════════════════════════════════════════════════════");
        } catch (Exception e) {
            Log.e(TAG, "❌ Error enviando broadcast: " + e.getMessage(), e);
        }
    }
    
    /**
     * Envía el broadcast de tarea a Tasker (versión legacy sin verificación)
     */
    private void sendTaskBroadcast(String taskerPackage, ReadableMap extras) {
        try {
            Log.d(TAG, "╔═══════════════════════════════════════════════════════╗");
            Log.d(TAG, "║         📤 ENVIANDO BROADCAST DE TAREA              ║");
            Log.d(TAG, "╚═══════════════════════════════════════════════════════╝");
            
            String taskerAction = "net.dinglisch.android.tasker.ACTION_TASK";
            Log.d(TAG, "📡 Acción: " + taskerAction);
            Log.d(TAG, "📦 Paquete destino: " + taskerPackage);
            
            Intent intent = new Intent(taskerAction);
            intent.setPackage(taskerPackage);
            Log.d(TAG, "✅ Intent creado y paquete configurado");
            
            // Configurar tarea
            String nombreTarea;
            if (extras != null && extras.hasKey("task_name")) {
                nombreTarea = extras.getString("task_name");
                Log.d(TAG, "🎯 Tarea desde extras: '" + nombreTarea + "'");
            } else {
                nombreTarea = "Keepalive";
                Log.d(TAG, "🎯 Tarea por defecto: '" + nombreTarea + "'");
            }
            
            intent.putExtra("task_name", nombreTarea);
            Log.d(TAG, "✅ Extra 'task_name' agregado al Intent");
            
            // Agregar extras adicionales
            if (extras != null) {
                if (extras.hasKey("source")) {
                    String source = extras.getString("source");
                    intent.putExtra("source", source);
                    Log.d(TAG, "  ℹ️ Extra 'source': " + source);
                }
                if (extras.hasKey("timestamp")) {
                    String timestamp = extras.getString("timestamp");
                    intent.putExtra("timestamp", timestamp);
                    Log.d(TAG, "  ℹ️ Extra 'timestamp': " + timestamp);
                }
            }
            
            intent.addFlags(Intent.FLAG_INCLUDE_STOPPED_PACKAGES);
            intent.addFlags(Intent.FLAG_RECEIVER_FOREGROUND);
            Log.d(TAG, "🚩 Flags agregados:");
            Log.d(TAG, "  • FLAG_INCLUDE_STOPPED_PACKAGES");
            Log.d(TAG, "  • FLAG_RECEIVER_FOREGROUND");
            
            Log.d(TAG, "📡 Enviando broadcast al sistema Android...");
            reactContext.sendBroadcast(intent);
            
            Log.d(TAG, "✅ ¡Broadcast enviado exitosamente!");
            Log.d(TAG, "🎯 Tarea: '" + nombreTarea + "'");
            Log.d(TAG, "📦 Destino: " + taskerPackage);
            Log.d(TAG, "💡 Tasker debería recibir y ejecutar la tarea ahora");
            Log.d(TAG, "═══════════════════════════════════════════════════════");
        } catch (Exception e) {
            Log.e(TAG, "╔═══════════════════════════════════════════════════════╗");
            Log.e(TAG, "║      ❌ ERROR ENVIANDO BROADCAST DE TAREA           ║");
            Log.e(TAG, "╚═══════════════════════════════════════════════════════╝");
            Log.e(TAG, "❌ Tipo de error: " + e.getClass().getSimpleName());
            Log.e(TAG, "❌ Mensaje: " + e.getMessage());
            Log.e(TAG, "❌ Stack trace:", e);
            Log.e(TAG, "═══════════════════════════════════════════════════════");
        }
    }
    
    /**
     * Verifica si una app está corriendo en este momento
     */
    private boolean isAppRunning(String packageName) {
        ActivityManager activityManager = (ActivityManager) reactContext.getSystemService(reactContext.ACTIVITY_SERVICE);
        if (activityManager == null) {
            return false;
        }
        
        List<ActivityManager.RunningAppProcessInfo> processes = activityManager.getRunningAppProcesses();
        if (processes != null) {
            for (ActivityManager.RunningAppProcessInfo processInfo : processes) {
                if (processInfo.processName.equals(packageName)) {
                    Log.d(TAG, "  ✅ Proceso encontrado: " + packageName);
                    return true;
                }
            }
        }
        
        Log.d(TAG, "  ❌ Proceso NO encontrado: " + packageName);
        return false;
    }

    private boolean isAppInstalled(String packageName) {
        try {
            reactContext.getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
