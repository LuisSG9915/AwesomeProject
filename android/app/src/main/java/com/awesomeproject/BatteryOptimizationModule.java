package com.awesomeproject;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * Módulo nativo para gestionar la exención de optimización de batería.
 * CRÍTICO para sincronización en background - sin esto, Android Doze suspende la red.
 */
public class BatteryOptimizationModule extends ReactContextBaseJavaModule {
    private static final String TAG = "BatteryOptimization";
    private final ReactApplicationContext reactContext;

    public BatteryOptimizationModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @Override
    public String getName() {
        return "BatteryOptimization";
    }

    /**
     * Verifica si la app está exenta de optimización de batería
     */
    @ReactMethod
    public void isIgnoringBatteryOptimizations(Promise promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) reactContext.getSystemService(Context.POWER_SERVICE);
                String packageName = reactContext.getPackageName();
                boolean isIgnoring = pm.isIgnoringBatteryOptimizations(packageName);
                Log.d(TAG, "🔋 isIgnoringBatteryOptimizations: " + isIgnoring);
                promise.resolve(isIgnoring);
            } else {
                // Android < 6.0 no tiene Doze
                promise.resolve(true);
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Error verificando optimización de batería: " + e.getMessage());
            promise.reject("ERROR", e.getMessage());
        }
    }

    /**
     * Abre la configuración para solicitar exención de batería
     * NOTA: No se puede solicitar directamente sin que el usuario interactúe
     */
    @ReactMethod
    public void requestIgnoreBatteryOptimizations(Promise promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) reactContext.getSystemService(Context.POWER_SERVICE);
                String packageName = reactContext.getPackageName();
                
                if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                    Intent intent = new Intent();
                    intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + packageName));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    
                    reactContext.startActivity(intent);
                    Log.d(TAG, "🔋 Abriendo diálogo de exención de batería");
                    promise.resolve(true);
                } else {
                    Log.d(TAG, "🔋 Ya está exenta de optimización de batería");
                    promise.resolve(false); // Ya está exenta
                }
            } else {
                promise.resolve(false);
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Error solicitando exención: " + e.getMessage());
            promise.reject("ERROR", e.getMessage());
        }
    }

    /**
     * Abre la configuración de batería de la app (alternativa manual)
     */
    @ReactMethod
    public void openBatterySettings(Promise promise) {
        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                intent.setAction(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            } else {
                intent.setAction(Settings.ACTION_SETTINGS);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(intent);
            Log.d(TAG, "🔋 Abriendo configuración de batería");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "❌ Error abriendo configuración: " + e.getMessage());
            promise.reject("ERROR", e.getMessage());
        }
    }
}
