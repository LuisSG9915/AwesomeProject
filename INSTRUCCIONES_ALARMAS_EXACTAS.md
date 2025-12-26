# Sincronización con Alarmas Exactas - Instrucciones

## ✅ Cambios Implementados

Se ha implementado sincronización **cada 1 minuto en background** usando AlarmManager nativo de Android.

### Archivos Creados:

- `android/app/src/main/java/com/awesomeproject/ExactAlarmSyncModule.kt` - Módulo nativo
- `android/app/src/main/java/com/awesomeproject/ExactAlarmSyncPackage.kt` - Package
- `services/ExactAlarmSyncService.ts` - Servicio JavaScript

### Archivos Modificados:

- `android/app/src/main/java/com/awesomeproject/MainApplication.kt` - Registra módulo
- `android/app/src/main/AndroidManifest.xml` - Permisos y BroadcastReceiver
- `services/BackgroundSyncService.ts` - Integración automática

### ⚠️ ForegroundService DESACTIVADO

- **Razón 1**: Evita colisiones con alarmas exactas
- **Razón 2**: Elimina notificación persistente (no deseada)
- **Razón 3**: Las alarmas exactas son suficientes

### ✅ SyncStatusPanel MANTENER

- Solo muestra información visual cuando la app está abierta
- NO interfiere con sincronizaciones en background
- Útil para el usuario ver el estado

---

## 📦 Compilar e Instalar

### Opción 1: APK Release (Recomendado)

```bash
cd android
./gradlew assembleRelease
cd ..
```

APK ubicado en: `android/app/build/outputs/apk/release/app-release.apk`

### Opción 2: Instalar directamente

```bash
npx react-native run-android --variant=release
```

---

## ⚙️ Configuración Requerida en el Dispositivo

### 1. Alarmas y Recordatorios (Android 12+)

**CRÍTICO** - Sin esto NO funcionará en background

```
Configuración → Apps → AwesomeProject → Alarmas y recordatorios → ✅ Activar
```

### 2. Optimización de Batería

**IMPORTANTE** - Para mejor rendimiento

```
Configuración → Batería → Optimización de batería → AwesomeProject → Sin restricciones
```

### 3. Notificaciones

**REQUERIDO** - Para permisos del sistema

```
Configuración → Apps → AwesomeProject → Notificaciones → ✅ Activar
```

---

## 🔍 Cómo Verificar que Funciona

### Prueba 1: Verificar Logs al Iniciar

Al abrir la app, deberías ver en logcat:

```
[BackgroundSync] ⚡ Configurando alarmas exactas (cada 1 min)...
[BackgroundSync] ✅ Alarmas exactas iniciadas - sincronizará cada 1 min
[BackgroundSync] ✅ Sin notificación persistente
[BackgroundSync] ℹ️ ForegroundService desactivado - usando solo alarmas exactas
```

### Prueba 2: Verificar Sincronización en Background

1. Abre la app y espera a que sincronice (verás en SyncStatusPanel)
2. Anota la hora de última sincronización
3. **Cambia a otra app** (WhatsApp, Chrome, etc.)
4. Espera **2-3 minutos**
5. Vuelve a la app
6. Verifica en la base de datos si hay nuevos registros de sincronización

### Prueba 3: Verificar en Base de Datos

```sql
-- Ver últimas sincronizaciones
SELECT * FROM SyncLog ORDER BY startedAt DESC LIMIT 10;

-- Ver sincronizaciones por tabla
SELECT * FROM SyncTableLog ORDER BY syncedAt DESC LIMIT 20;
```

---

## 🏗️ Arquitectura Final

```
┌─────────────────────────────────────────────────────────┐
│ APP EN PRIMER PLANO                                     │
│ → setInterval cada 1 min (preciso)                      │
├─────────────────────────────────────────────────────────┤
│ CAMBIO A OTRA APP (background real)                     │
│ → AlarmManager con alarmas exactas cada 1 min           │
│ → Ignora Doze Mode y optimización de batería            │
│ → Sin notificación persistente                          │
├─────────────────────────────────────────────────────────┤
│ RESPALDO (si alarmas exactas fallan)                    │
│ → BackgroundFetch + HeadlessTask cada ~15 min           │
└─────────────────────────────────────────────────────────┘
```

---

## ⚠️ Advertencias Importantes

### Consumo de Batería

Sincronizar cada minuto consume **más batería** que intervalos estándar. Esto es inevitable para cumplir el requisito del cliente.

### Políticas de Fabricantes

Algunos fabricantes (Xiaomi, Huawei, Samsung) tienen políticas agresivas de ahorro de batería:

- **Xiaomi**: Configuración → Batería → Ahorro de batería → AwesomeProject → Sin restricciones
- **Huawei**: Configuración → Batería → Inicio de aplicaciones → AwesomeProject → Administrar manualmente
- **Samsung**: Configuración → Batería → Uso de batería → AwesomeProject → Permitir actividad en segundo plano

### No para Google Play Store

Esta implementación usa alarmas exactas frecuentes. Google Play puede rechazar apps que abusen de este permiso sin justificación clara. **Usar solo para distribución directa (APK)**.

---

## 🐛 Solución de Problemas

### Problema: "No se pueden programar alarmas exactas"

**Solución**: Habilitar permiso en Configuración → Apps → Alarmas y recordatorios

### Problema: Sincronización no funciona en background

**Solución**:

1. Verificar permisos de alarmas
2. Desactivar optimización de batería
3. Verificar que no haya "limpiadores" de apps activos

### Problema: App crashea al iniciar

**Solución**: Verificar que todos los archivos Kotlin se compilaron correctamente

```bash
cd android
./gradlew clean
./gradlew assembleRelease
```

---

## 📊 Monitoreo

### Ver Logs en Tiempo Real

```bash
# Android Studio Logcat o:
adb logcat | grep -E "BackgroundSync|ExactAlarmSync|HeadlessTask|SyncAlarmReceiver"
```

### Filtros Útiles:

- `[BackgroundSync]` - Servicio principal
- `[ExactAlarmSync]` - Módulo nativo
- `[SyncAlarmReceiver]` - BroadcastReceiver
- `[HeadlessTask]` - Ejecución en background

---

## ✅ Checklist de Instalación

- [ ] Compilar APK release
- [ ] Instalar en dispositivo
- [ ] Habilitar permiso de Alarmas y recordatorios
- [ ] Desactivar optimización de batería
- [ ] Habilitar notificaciones
- [ ] Probar sincronización con app abierta
- [ ] Probar sincronización cambiando de app
- [ ] Verificar registros en base de datos
- [ ] Monitorear consumo de batería

---

## 📞 Soporte

Si hay problemas, revisar:

1. Logs de Android (logcat)
2. Tabla SyncLog en la base de datos
3. Permisos del sistema
4. Configuración del fabricante
