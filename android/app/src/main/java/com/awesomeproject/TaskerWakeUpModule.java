package com.awesomeproject;

import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;

/**
 * Módulo nativo para enviar broadcast intents a Tasker
 * Esto permite "despertar" a Tasker cuando el sistema lo ha matado
 */
public class TaskerWakeUpModule extends ReactContextBaseJavaModule {
    private static final String TAG = "TaskerWakeUp";
    private final ReactApplicationContext reactContext;

    public TaskerWakeUpModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
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

    private boolean isAppInstalled(String packageName) {
        try {
            reactContext.getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
