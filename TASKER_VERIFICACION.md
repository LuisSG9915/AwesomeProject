# 📡 Configuración de Verificación de Tasker (ACTUALIZADO)

## 🎯 Cambio Importante

La app ahora usa un **Intent personalizado** (`com.awesomeproject.VERIFY_TASKER`) en lugar de `ACTION_TASK`. Esto permite que Tasker reciba los extras como variables automáticamente.

---

## 📋 Configuración en Tasker

### **Paso 1: Crear Perfil de Escucha**

1. Abre Tasker
2. Ve a la pestaña **PERFILES** (Profiles)
3. Toca **+** (agregar nuevo perfil)
4. Selecciona **Event** (Evento)
5. Categoría: **System** → **Intent Received**
6. En **Action**, escribe **exactamente**:
   ```
   com.awesomeproject.VERIFY_TASKER
   ```
7. Toca la flecha **←** (Atrás)
8. Selecciona la tarea **Keepalive** (o créala si no existe)

### **Paso 2: Configurar Tarea "Keepalive"**

La tarea debe tener solo **UNA acción**:

#### **Acción: Send Intent** (Enviar respuesta)

```
Plugin: Send Intent
Action: com.awesomeproject.TASKER_RESPONSE
Extra: request_id:%request_id
Extra: status:ok
Target: Broadcast Receiver
```

**Configuración de cada Extra:**

- **Extra 1**: `request_id:%request_id` (formato: nombre:valor)
- **Extra 2**: `status:ok`

**⚠️ Ya NO necesitas:**

- ❌ Variable Set al inicio
- ❌ Acción Flash (opcional, solo para debugging)

---

## 🔧 Estructura Final

```
PERFIL: Intent Received
├─ Action: com.awesomeproject.VERIFY_TASKER
└─ Tarea vinculada: Keepalive

TAREA: Keepalive
└─ Send Intent
   ├─ Action: com.awesomeproject.TASKER_RESPONSE
   ├─ Extra: request_id:%request_id
   ├─ Extra: status:ok
   └─ Target: Broadcast Receiver
```

---

## 📝 Variables Disponibles Automáticamente

Cuando tu app envía el Intent, Tasker crea estas variables automáticamente:

| Variable      | Ejemplo                                |
| ------------- | -------------------------------------- |
| `%request_id` | `bab5da79-2c86-48ed-a5b4-212284a6db7a` |
| `%task_name`  | `Keepalive`                            |
| `%source`     | `app_launch` o `app_foreground`        |
| `%timestamp`  | `1769039071092`                        |

---

## 🧪 Probar

### **Test 1: Con Tasker Abierto**

1. Abre Tasker manualmente
2. Abre tu app
3. **Esperado**: NO debe abrir Tasker de nuevo

**Logs esperados:**

```
TaskerWakeUpModule: 📡 Acción: com.awesomeproject.VERIFY_TASKER
TaskerResponseReceiver: 📥 RESPUESTA DE TASKER RECIBIDA
TaskerResponseReceiver: 📋 Request ID: bab5da79-2c86-48ed-a5b4-212284a6db7a
TaskerWakeUpModule: ✅ Request marcado como completado
TaskerWakeUpModule: ⏱️ Tiempo de respuesta: 150ms
```

### **Test 2: Con Tasker Cerrado**

1. Forzar detención: `Configuración > Apps > Tasker > Forzar detención`
2. Abre tu app
3. **Esperado**: Tasker se abre después de 5 segundos

**Logs esperados:**

```
TaskerWakeUpModule: ⏱️ TIMEOUT - TASKER NO RESPONDIÓ
TaskerWakeUpModule: ☢️ Iniciando ACTIVACIÓN NUCLEAR...
TaskerWakeUpModule: 🚀 Abriendo Tasker para revivirlo...
```

---

## 🔍 Ver Logs

```bash
adb logcat -c && adb logcat TaskerWakeUpModule:* TaskerResponseReceiver:* *:S
```

---

## ✅ Resumen

- ✅ Intent personalizado permite que Tasker reciba variables automáticamente
- ✅ No necesitas extraer manualmente los extras
- ✅ Verificación funciona correctamente
- ✅ Tasker solo se abre si realmente está muerto
