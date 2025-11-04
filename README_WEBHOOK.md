# 📡 Sistema de Webhooks para React Native

## 🚀 Instalación

```bash
# Instalar dependencias
npm install realm @react-navigation/native @react-navigation/native-stack react-native-safe-area-context react-native-screens react-native-elements

# Para iOS
cd ios && pod install
```

## 📋 Características

- ✅ **Envío de webhooks en JSON** sin autenticación
- ✅ **Logging completo** con almacenamiento en Realm
- ✅ **Reintentos automáticos** (hasta 3 intentos)
- ✅ **Panel de administración** para gestionar suscripciones
- ✅ **Estadísticas en tiempo real**
- ✅ **Integración fácil** con servicios existentes

## 🏗️ Arquitectura

### Servicios

1. **WebhookService.js** - Servicio principal con Realm
   - Maneja conexión a base de datos
   - Envío de webhooks con reintentos
   - Logging de todos los eventos

2. **WebhookManager.js** - Interface de alto nivel
   - Métodos específicos para cada tipo de evento
   - Integración con WebhookService
   - Fácil de usar en toda la app

3. **ClienteService.js** - Ejemplo de integración
   - Muestra cómo enviar webhooks al crear clientes
   - Puede adaptarse para tu API real

### Componentes

1. **WebhookScreen.js** - Panel de administración
   - Ver logs y estadísticas
   - Agregar/eliminar suscripciones
   - Enviar webhooks de prueba

2. **ClienteForm.js** - Formulario de ejemplo
   - Crear clientes con webhook automático
   - Interfaz amigable para testing

## 📊 Eventos Soportados

### Cliente Creado
```javascript
await WebhookManager.notifyClienteCreado({
  id: 123,
  nombre: "Juan Pérez",
  email: "juan@example.com",
  telefono: "1234567890",
  fecha_alta: "2025-10-30T17:00:00Z",
  usuarioEjecuta: 1,
  ip: "192.168.1.100",
  dispositivo: "Mobile"
});
```

### Cliente Actualizado
```javascript
await WebhookManager.notifyClienteActualizado({
  id: 123,
  nombre: "Juan Pérez Actualizado",
  email: "juan.nuevo@example.com",
  // ... otros campos
});
```

### Venta Creada
```javascript
await WebhookManager.notifyVentaCreada({
  id: 456,
  folio: "VENTA-001",
  clienteId: 123,
  clienteNombre: "Juan Pérez",
  total: 1500.00,
  fecha: "2025-10-30T17:00:00Z"
});
```

### Eventos Personalizados
```javascript
await WebhookManager.notifyCustomEvent('mi_evento', {
  mensaje: 'Mi evento personalizado',
  datos: { /* tus datos */ }
});
```

## 🔧 Configuración

### 1. Inicializar en App.js
```javascript
import WebhookManager from './services/WebhookManager';

useEffect(() => {
  WebhookManager.initialize().catch(console.error);
}, []);
```

### 2. Usar en cualquier componente
```javascript
import WebhookManager from './services/WebhookManager';

// Enviar notificación
await WebhookManager.notifyClienteCreado(clienteData);

// Obtener estadísticas
const stats = WebhookManager.getEstadisticas();

// Ver logs recientes
const logs = WebhookManager.getRecentLogs(20);
```

### 3. Agregar suscripciones
```javascript
// Programáticamente
await WebhookManager.addSubscription(
  'cliente_creado',
  'https://api.example.com/webhook',
  'secret-opcional'
);

// O desde la UI en WebhookScreen
```

## 📱 Uso en la App

### Navegación
La app incluye navegación a la pantalla de webhooks:

1. Abre la app
2. Toca el botón "📡 Gestionar Webhooks"
3. Administra tus suscripciones y ve logs

### Crear Cliente con Webhook
1. Ve al formulario de cliente
2. Completa los datos
3. Toca "🚀 Crear Cliente y Enviar Webhook"
4. El webhook se envía automáticamente a todos los suscriptores

## 🗄️ Base de Datos (Realm)

### Esquema de Logs
```javascript
WebhookLog {
  id: int (primary key),
  eventType: string,
  url: string,
  payload: string,
  status: string, // 'success' | 'failed'
  responseCode: int?,
  responseMessage: string?,
  attempts: int,
  sentAt: date,
  createdAt: date
}
```

### Esquema de Suscripciones
```javascript
WebhookSubscription {
  id: int (primary key),
  event: string,
  url: string,
  secret: string?,
  isActive: bool,
  createdAt: date,
  updatedAt: date
}
```

## 🔄 Flujo de Webhook

1. **Evento ocurre** en la app (ej: crear cliente)
2. **WebhookManager** recibe los datos
3. **WebhookService** busca suscriptores activos
4. **Envía webhook** a cada URL con JSON
5. **Reintentos automáticos** si falla (máximo 3)
6. **Guarda log** en Realm con resultado
7. **Actualiza estadísticas** en tiempo real

## 📈 Formato de Webhook

```json
{
  "eventType": "cliente_creado",
  "timestamp": "2025-10-30T17:00:00Z",
  "data": {
    "tipo": "cliente_creado",
    "mensaje": "Nuevo cliente creado: Juan Pérez",
    "datos": {
      "clienteId": 123,
      "nombre": "Juan Pérez",
      "email": "juan@example.com",
      "telefono": "1234567890",
      "fechaAlta": "2025-10-30T17:00:00Z",
      "usuarioEjecuta": 1,
      "ip": "Mobile App",
      "dispositivo": "React Native"
    }
  }
}
```

## 🛠️ Mantenimiento

### Limpiar Logs Antiguos
```javascript
// Automático cada 24 horas
WebhookService.cleanOldLogs();

// Manual
await WebhookService.cleanOldLogs();
```

### Verificar Estado
```javascript
// Estadísticas generales
const stats = WebhookManager.getEstadisticas();
console.log(`Total: ${stats.total}, Éxitos: ${stats.success}, Fallos: ${stats.failed}`);

// Logs recientes
const logs = WebhookManager.getRecentLogs(10);
logs.forEach(log => console.log(`${log.eventType}: ${log.status}`));
```

## 🌐 Ejemplos de Endpoints Externos

### Servidor Node.js (Ejemplo)
```javascript
app.post('/webhook/cliente-creado', (req, res) => {
  console.log('🎉 Cliente creado:', req.body);
  // Procesar el webhook
  res.status(200).send('Webhook recibido');
});
```

### PHP (Ejemplo)
```php
<?php
$json = file_get_contents('php://input');
$data = json_decode($json, true);

if ($data['eventType'] === 'cliente_creado') {
    // Procesar cliente creado
    error_log('Cliente creado: ' . $data['data']['datos']['nombre']);
}

http_response_code(200);
?>
```

## 🔍 Troubleshooting

### Webhooks no se envían
1. Verifica que `WebhookManager.initialize()` se ejecutó
2. Revisa que haya suscripciones activas
3. Verifica conexión a internet

### Logs no se guardan
1. Reinicia la app para inicializar Realm
2. Verifica permisos de almacenamiento
3. Limpia logs antiguos si la base está llena

### Suscripciones no funcionan
1. Verifica que la URL sea accesible
2. Confirma que el endpoint acepte POST
3. Revisa que el servidor responda con 2xx

## 📝 Notas

- **Sin autenticación**: Los webhooks se envían sin headers de auth
- **JSON siempre**: Todos los payloads son JSON
- **Logging completo**: Todos los eventos se registran
- **Offline**: Los webhooks fallidos se reintentan cuando hay conexión
- **Storage**: Los datos persisten entre sesiones con Realm

---

🚀 **¡Listo para usar!** El sistema está completamente integrado y funcionando.
