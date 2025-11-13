# 📡 Permisos de Bluetooth - Configuración Completa

## 📅 Fecha: 12 de Noviembre, 2025

## ✅ Permisos Agregados

### AndroidManifest.xml

Se agregaron todos los permisos necesarios para Bluetooth en Android:

```xml
<!-- Permisos Bluetooth para Android < 12 -->
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" android:maxSdkVersion="30" />

<!-- Permisos Bluetooth para Android 12+ -->
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />

<uses-feature android:name="android.hardware.bluetooth" android:required="false" />
```

## 📋 Explicación de Permisos

### Android < 12 (API Level ≤ 30)

| Permiso | Descripción | Necesario Para |
|---------|-------------|----------------|
| `BLUETOOTH` | Permiso básico Bluetooth | Conectar y transferir datos |
| `BLUETOOTH_ADMIN` | Administración Bluetooth | Descubrir y emparejar dispositivos |
| `ACCESS_FINE_LOCATION` | Ubicación precisa | Escanear dispositivos Bluetooth |
| `ACCESS_COARSE_LOCATION` | Ubicación aproximada | Escanear dispositivos Bluetooth |

**Nota:** En Android < 12, el escaneo Bluetooth requiere permisos de ubicación.

### Android ≥ 12 (API Level ≥ 31)

| Permiso | Descripción | Necesario Para |
|---------|-------------|----------------|
| `BLUETOOTH_SCAN` | Escanear dispositivos | Encontrar impresoras Bluetooth |
| `BLUETOOTH_CONNECT` | Conectar a dispositivos | Establecer conexión con impresora |

**Nota:** En Android 12+, ya no se requieren permisos de ubicación si usas `neverForLocation`.

## 🔧 Problemas Resueltos

### 1. Error: "android.support.v4"
**Problema:**
```
error: package android.support.v4.app does not exist
import android.support.v4.app.ActivityCompat;
```

**Solución:** Actualizar a AndroidX
```java
// Antes
import android.support.v4.app.ActivityCompat;
import android.support.v4.content.ContextCompat;

// Después
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
```

### 2. Dependencia AndroidX
**Agregada en build.gradle:**
```gradle
dependencies {
    ...
    implementation "androidx.core:core:1.6.0"
}
```

## 📱 Flujo de Permisos en la App

### 1. Permisos en Tiempo de Ejecución

El servicio `BluetoothPrinterService` solicita permisos automáticamente:

```typescript
async requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    if (Platform.Version >= 31) {
      // Android 12+
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return granted['android.permission.BLUETOOTH_SCAN'] === 'granted' &&
             granted['android.permission.BLUETOOTH_CONNECT'] === 'granted';
    } else {
      // Android < 12
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return granted === 'granted';
    }
  }
  return true; // iOS no necesita solicitud
}
```

### 2. Cuándo se Solicitan

Los permisos se solicitan cuando el usuario:
1. Abre "Configuración de Impresora"
2. Hace click en "🔍 Escanear Dispositivos"
3. App solicita permisos → Usuario acepta → Escaneo inicia

### 3. Si Usuario Rechaza

```typescript
if (!hasPermissions) {
  Alert.alert(
    'Permisos Necesarios',
    'Se requieren permisos de Bluetooth para buscar impresoras'
  );
  return [];
}
```

## 🎯 Experiencia de Usuario

### Primera Vez
```
1. Usuario abre "Configuración de Impresora"
2. Click en "🔍 Escanear Dispositivos"
3. Sistema solicita permisos:
   
   ┌────────────────────────────────────┐
   │ ⚠️ Permisos Bluetooth              │
   │                                    │
   │ AwesomeProject necesita acceso a   │
   │ Bluetooth para buscar impresoras   │
   │                                    │
   │    [Denegar]      [Permitir]       │
   └────────────────────────────────────┘

4. Usuario acepta → Escaneo inicia
5. Lista de impresoras aparece
```

### Usos Posteriores
```
1. Usuario abre "Configuración de Impresora"
2. Click en "🔍 Escanear Dispositivos"
3. Escaneo inicia inmediatamente (permisos ya otorgados)
4. Lista de impresoras aparece
```

## ⚠️ Troubleshooting

### Error: "Permisos Necesarios"

**Problema:** App solicita permisos pero no encuentra impresoras

**Solución:**
1. Verificar que Bluetooth esté activado
2. Ir a Configuración del sistema → Apps → AwesomeProject → Permisos
3. Verificar que Bluetooth y/o Ubicación estén permitidos
4. Reiniciar la app

### Error: Permisos Denegados Permanentemente

Si el usuario seleccionó "No volver a preguntar":

```typescript
// La app debe guiar al usuario a configuración
Alert.alert(
  'Permisos Requeridos',
  'Ve a Configuración → Apps → AwesomeProject → Permisos y activa Bluetooth',
  [
    { text: 'Cancelar' },
    { text: 'Abrir Configuración', onPress: () => {
      // Abrir configuración de la app
      Linking.openSettings();
    }}
  ]
);
```

### Error: No Encuentra Impresoras (Permisos OK)

**Verificar:**
1. ✅ Bluetooth del teléfono activado
2. ✅ Impresora encendida
3. ✅ Impresora en modo emparejamiento/visible
4. ✅ Distancia < 10 metros
5. ✅ Impresora no conectada a otro dispositivo

## 📱 Versiones de Android

### Android 12+ (API 31+)
```xml
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```
- ✅ No requiere ubicación
- ✅ Más privacidad
- ✅ Permisos específicos

### Android 11 y anteriores (API ≤ 30)
```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```
- ⚠️ Requiere ubicación
- ⚠️ Usuario ve "permitir ubicación" (puede confundir)
- ✅ Compatible con versiones antiguas

## 🔒 Privacidad

### neverForLocation Flag

```xml
<uses-permission 
  android:name="android.permission.BLUETOOTH_SCAN" 
  android:usesPermissionFlags="neverForLocation" />
```

**Beneficio:**
- Declara que la app NO usa Bluetooth para rastrear ubicación
- Sistema puede omitir solicitud de ubicación en Android 12+
- Mejora privacidad del usuario

## 📊 Resumen

| Aspecto | Estado |
|---------|--------|
| **Permisos declarados** | ✅ AndroidManifest.xml |
| **Solicitud en runtime** | ✅ BluetoothPrinterService |
| **AndroidX migrado** | ✅ Imports actualizados |
| **Dependencia agregada** | ✅ androidx.core:core:1.6.0 |
| **Compatibilidad** | ✅ Android 5.0+ (API 21+) |
| **Parche aplicado** | ✅ patch-package actualizado |

## 🎉 Estado Final

- ✅ Todos los permisos configurados
- ✅ AndroidX migrado
- ✅ Código Java actualizado
- ✅ Build.gradle parcheado
- ✅ Solicitud automática de permisos
- ✅ Compatible con todas las versiones de Android
- ✅ Listo para escanear impresoras

---

**📡 Configuración de Permisos Bluetooth Completa**
