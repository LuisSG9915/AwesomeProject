# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# ═══════════════════════════════════════════════════════════════════════
# REGLAS CRÍTICAS PARA TASKER WAKE UP MODULE
# ═══════════════════════════════════════════════════════════════════════
# Estas reglas evitan que R8/ProGuard ofusque las clases que manejan
# la comunicación con Tasker. Sin estas reglas, el listener estático
# se pierde en builds release y Tasker siempre se abre visualmente.

# Mantener el módulo completo sin ofuscar
-keep class com.awesomeproject.TaskerWakeUpModule {
    *;
}

# Mantener el receiver completo sin ofuscar
-keep class com.awesomeproject.TaskerResponseReceiver {
    *;
}

# CRÍTICO: Mantener la interfaz del listener y sus métodos
-keep interface com.awesomeproject.TaskerResponseReceiver$ResponseListener {
    *;
}

# Mantener el campo estático del listener (esto es lo MÁS importante)
-keepclassmembers class com.awesomeproject.TaskerResponseReceiver {
    private static com.awesomeproject.TaskerResponseReceiver$ResponseListener responseListener;
    public static void setResponseListener(com.awesomeproject.TaskerResponseReceiver$ResponseListener);
}

# Mantener la clase interna PendingRequest
-keep class com.awesomeproject.TaskerWakeUpModule$PendingRequest {
    *;
}

# Evitar que se eliminen métodos que parecen no usados pero son llamados por reflexión
-keepclassmembers class com.awesomeproject.TaskerWakeUpModule {
    public void onTaskerResponse(java.lang.String, java.lang.String);
}

# ═══════════════════════════════════════════════════════════════════════
