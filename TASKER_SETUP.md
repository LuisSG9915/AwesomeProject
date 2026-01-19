# 📡 Sistema de Inyección Directa de Tareas en Tasker

## 🎯 Objetivo

Este sistema ejecuta automáticamente una tarea en Tasker cuando abres la app, despertándolo incluso si Android lo ha detenido por ahorro de batería. **No requiere configurar perfiles ni "Intent Recibido"**.

---

## ⚡ Cómo Funciona

Cuando abres la app o la traes al primer plano, se envía un comando directo usando la **API nativa de Tasker** para ejecutar una tarea específica. Esto utiliza la acción oficial `ACTION_TASK` que Tasker tiene declarada internamente.

**Acción Nativa:** `net.dinglisch.android.tasker.ACTION_TASK`  
**Tarea Ejecutada:** `KeepAlive`

---

## 📋 PASO 1: Crear Tarea en Tasker

**¡MUCHO MÁS SIMPLE! Ya no necesitas crear perfiles.**

1. Abre **Tasker**
2. Ve a la pestaña **"Tareas"** (Tasks)
3. Toca el botón **+** (abajo a la derecha)
4. Dale un nombre **EXACTAMENTE**:

   ```
   KeepAlive
   ```

   ⚠️ **CRÍTICO:** El nombre debe ser **exactamente** `KeepAlive` (K mayúscula, resto minúsculas) sin espacios extras. Es **sensible a mayúsculas/minúsculas**.

5. Dentro de la tarea, agrega estas acciones:

   - Toca el **+** para agregar acción
   - **Categoría:** Tasker → Establecer Variable (Set Variable)
   - **Nombre:** `%TaskerStatus`
   - **A:** `Running`
   - Toca el botón **✓** (Aceptar)

6. _(Opcional pero recomendado)_ Agrega una segunda acción para confirmar visualmente:

   - Toca el **+** nuevamente
   - **Categoría:** Alerta → Flash
   - **Texto:** `Tasker despertado por AwesomeApp`
   - **Duración:** Corto
   - Toca el botón **✓** (Aceptar)

7. Presiona el botón **Atrás** (←) para guardar la tarea

**¡Eso es todo para el Paso 1! No necesitas crear perfiles.**

---

## 📋 PASO 2: Configurar Permisos de Tasker

### 2.1 Preferencias de Tasker

1. Abre **Tasker**
2. Toca el icono de **⚙️ Configuración** (Settings) arriba a la derecha
3. Ve a **Misceláneo** (Misc)

   - ✅ **Allow External Access** → Activar
   - ✅ **Run In Foreground** → Activar (crítico)

4. Ve a **Monitor**
   - ✅ **Run In Foreground** → Activar
   - ✅ **Use Reliable Alarms** → Seleccionar **"Always"**

### 2.2 Explicación

- **Allow External Access**: Permite que otras apps (como AwesomeApp) envíen intents a Tasker
- **Run In Foreground**: Mantiene a Tasker vivo mostrando una notificación permanente (necesario para que Android no lo mate)
- **Use Reliable Alarms**: Asegura que las alarmas de Tasker se ejecuten incluso en Doze Mode

---

## 📋 PASO 3: Configuración del Sistema Android

### 3.1 Desactivar Optimización de Batería

#### Para Tasker:

1. **Ajustes → Batería → Optimización de batería**
2. Buscar **Tasker**
3. Seleccionar **"No optimizar"** o **"Sin restricciones"**

#### Para AwesomeApp:

1. **Ajustes → Batería → Optimización de batería**
2. Buscar **AwesomeApp**
3. Seleccionar **"No optimizar"** o **"Sin restricciones"**

### 3.2 Permisos de Inicio Automático (Depende del fabricante)

#### Samsung (One UI):

1. **Ajustes → Aplicaciones → Tasker**
2. **Batería → Permitir actividad en segundo plano** → Activar
3. **Aplicaciones en reposo** → Eliminar Tasker de la lista

#### Xiaomi (MIUI):

1. **Ajustes → Aplicaciones → Administrar aplicaciones → Tasker**
2. **Inicio automático** → Activar
3. **Ahorro de batería** → Sin restricciones
4. **Restricciones en segundo plano** → Desactivar

#### Huawei (EMUI):

1. **Ajustes → Aplicaciones → Tasker**
2. **Inicio** → Activar
3. **Gestión de batería** → Gestión manual → Permitir todo

#### OnePlus/Oppo (ColorOS):

1. **Ajustes → Batería → Optimización de batería**
2. Tasker → No optimizar
3. **Permisos de inicio automático** → Activar para Tasker

---

## 📋 PASO 4: Prueba del Sistema

### 4.1 Verificar que Funciona

1. Abre **AwesomeApp**
2. Revisa el **logcat** de Android:
   ```bash
   adb logcat -s TaskerWakeUp:D TaskerBroadcastReceiver:D
   ```
3. Deberías ver:
   ```
   [TaskerWakeUp] ⚡ Señal enviada a Tasker desde: app_launch
   [TaskerWakeUp] 📡 Action: com.awesomeapp.DESPERTAR_TASKER
   ```

### 4.2 Probar Después de Super Ahorro

1. Activa **Modo Super Ahorro de Batería** en tu teléfono
2. Espera 5-10 minutos
3. Desactiva el modo de ahorro
4. Abre **AwesomeApp**
5. Tasker debería despertar automáticamente

---

## 🔍 Solución de Problemas

### ❌ Tasker no recibe el broadcast

**Verificar:**

1. ¿Está activado "Allow External Access" en Tasker?
2. ¿El Intent Received tiene la acción correcta?
   - Debe ser EXACTAMENTE: `com.awesomeapp.DESPERTAR_TASKER`
3. ¿Tasker está en "Run In Foreground"?

### ❌ Tasker sigue muriendo después de modo ahorro

**Verificar:**

1. ¿Desactivaste la optimización de batería para Tasker?
2. ¿Activaste el inicio automático en las configuraciones del fabricante?
3. ¿Tasker muestra una notificación permanente? (debe mostrarla si Run In Foreground está activo)

### ❌ El broadcast se envía pero Tasker no reacciona

**Usar ADB para depurar:**

```bash
# Ver todos los broadcasts en el sistema
adb logcat -s BroadcastQueue:V

# Enviar el broadcast manualmente para probar
adb shell am broadcast -a com.awesomeapp.DESPERTAR_TASKER
```

---

## 📊 Logs y Monitoreo

### Ver logs de la app en tiempo real:

```bash
adb logcat -s TaskerWakeUp:D BluetoothPrinterService:D
```

### Ver todos los logs del sistema relacionados:

```bash
adb logcat | grep -i "tasker\|broadcast\|awesomeapp"
```

---

## 🎯 Eventos que Disparan el Despertar

El sistema envía el broadcast en estos momentos:

1. **Al iniciar la app** (`app_launch`)
2. **Al volver del background** (`app_foreground`)
3. **Manualmente** (si se llama `TaskerWakeUpService.forceWakeUp()`)

---

## ⚠️ Limitaciones

1. **No funciona si ambas apps están muertas**: Si tanto AwesomeApp como Tasker están completamente detenidas, el usuario debe abrir una de las dos manualmente.

2. **Android 12+**: Tiene restricciones más estrictas. Asegúrate de que ambas apps tengan los permisos correctos.

3. **Fabricantes agresivos**: Samsung, Xiaomi, Huawei son muy agresivos matando apps. Necesitas configurar cada ajuste mencionado.

---

## ✅ Checklist Final

- [ ] Tasker: Perfil de Intent Received creado con acción correcta
- [ ] Tasker: Tarea asociada con al menos una acción
- [ ] Tasker: Allow External Access activado
- [ ] Tasker: Run In Foreground activado
- [ ] Tasker: Use Reliable Alarms en "Always"
- [ ] Sistema: Tasker sin optimización de batería
- [ ] Sistema: AwesomeApp sin optimización de batería
- [ ] Sistema: Inicio automático activado para Tasker
- [ ] Prueba: Broadcast se envía al abrir la app
- [ ] Prueba: Tasker recibe el broadcast y ejecuta la tarea

---

## 🚀 Resultado Esperado

Una vez configurado correctamente, cada vez que el usuario abra **AwesomeApp**, Tasker recibirá automáticamente una señal silenciosa que lo despertará si el sistema lo había detenido, **sin que el usuario vea ninguna ventana o tenga que hacer nada manualmente**.

---

**Acción configurada:** `com.awesomeapp.DESPERTAR_TASKER`

**Módulo nativo:** `TaskerWakeUpModule.java`

**Servicio TypeScript:** `TaskerWakeUpService.ts`
