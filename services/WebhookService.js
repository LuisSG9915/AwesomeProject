import Realm from 'realm';

// Esquema para almacenar webhooks enviados
const WebhookLogSchema = {
  name: 'WebhookLog',
  properties: {
    id: 'int',
    eventType: 'string',
    url: 'string',
    payload: 'string',
    status: 'string',
    responseCode: 'int?',
    responseMessage: 'string?',
    attempts: 'int',
    sentAt: 'date',
    createdAt: 'date'
  },
  primaryKey: 'id'
};

// Esquema para suscriptores de webhooks
const WebhookSubscriptionSchema = {
  name: 'WebhookSubscription',
  properties: {
    id: 'int',
    event: 'string',
    url: 'string',
    secret: 'string?',
    isActive: 'bool',
    createdAt: 'date',
    updatedAt: 'date'
  },
  primaryKey: 'id'
};

class WebhookService {
  constructor() {
    this.realm = null;
    this.isInitialized = false;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 segundo
  }

  // Inicializar base de datos Realm
  async initialize() {
    try {
      this.realm = await Realm.open({
        path: 'WebhookDB',
        schema: [WebhookLogSchema, WebhookSubscriptionSchema],
        schemaVersion: 1
      });
      
      this.isInitialized = true;
      console.log('✅ WebhookService inicializado con Realm');
      
      // Crear suscripciones por defecto si no existen
      await this.createDefaultSubscriptions();
      
    } catch (error) {
      console.error('❌ Error inicializando WebhookService:', error);
      throw error;
    }
  }

  // Crear suscripciones por defecto
  async createDefaultSubscriptions() {
    const defaultSubscriptions = [
      {
        event: 'cliente_creado',
        url: 'https://api.example.com/webhooks/cliente-creado',
        secret: null
      },
      {
        event: 'venta_creada',
        url: 'https://api.example.com/webhooks/venta-creada',
        secret: null
      },
      {
        event: 'inventario_actualizado',
        url: 'https://api.example.com/webhooks/inventario',
        secret: null
      }
    ];

    for (const sub of defaultSubscriptions) {
      const existing = this.realm.objects('WebhookSubscription').filtered('event = $0', sub.event);
      if (existing.length === 0) {
        const nextId = this.getNextId('WebhookSubscription');
        this.realm.write(() => {
          this.realm.create('WebhookSubscription', {
            id: nextId,
            event: sub.event,
            url: sub.url,
            secret: sub.secret,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        });
      }
    }
  }

  // Obtener siguiente ID para una tabla
  getNextId(tableName) {
    const objects = this.realm.objects(tableName);
    return objects.length > 0 ? objects.max('id') + 1 : 1;
  }

  // Enviar webhook para un evento específico
  async sendWebhook(eventType, data) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Obtener suscriptores activos para este evento
    const subscriptions = this.realm.objects('WebhookSubscription')
      .filtered('event = $0 AND isActive = true', eventType);

    console.log(`📡 Enviando webhook ${eventType} a ${subscriptions.length} suscriptores`);

    const promises = subscriptions.map(subscription => 
      this.sendWebhookToUrl(eventType, data, subscription)
    );

    await Promise.allSettled(promises);
  }

  // Enviar webhook a una URL específica
  async sendWebhookToUrl(eventType, data, subscription) {
    const logId = this.getNextId('WebhookLog');
    let attempts = 0;
    let success = false;
    let responseCode = null;
    let responseMessage = null;

    const payload = {
      eventType,
      timestamp: new Date().toISOString(),
      data: data
    };

    while (attempts < this.maxRetries && !success) {
      attempts++;
      
      try {
        const response = await fetch(subscription.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'AwesomeApp-Webhook/1.0'
          },
          body: JSON.stringify(payload)
        });

        responseCode = response.status;
        responseMessage = response.statusText;

        if (response.ok) {
          success = true;
          console.log(`✅ Webhook enviado exitosamente a ${subscription.url}`);
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

      } catch (error) {
        console.error(`❌ Intento ${attempts} fallido para ${subscription.url}:`, error.message);
        responseMessage = error.message;
        
        if (attempts < this.maxRetries) {
          await this.delay(this.retryDelay * attempts); // Backoff exponencial
        }
      }
    }

    // Guardar log en Realm
    this.saveWebhookLog({
      id: logId,
      eventType,
      url: subscription.url,
      payload: JSON.stringify(payload),
      status: success ? 'success' : 'failed',
      responseCode,
      responseMessage,
      attempts,
      sentAt: new Date(),
      createdAt: new Date()
    });

    return success;
  }

  // Guardar log de webhook
  saveWebhookLog(logData) {
    try {
      this.realm.write(() => {
        this.realm.create('WebhookLog', logData);
      });
    } catch (error) {
      console.error('❌ Error guardando log de webhook:', error);
    }
  }

  // Obtener logs de webhooks
  getWebhookLogs(limit = 50) {
    if (!this.isInitialized) {
      return [];
    }

    return this.realm.objects('WebhookLog')
      .sorted('createdAt', true)
      .slice(0, limit);
  }

  // Obtener suscripciones
  getSubscriptions() {
    if (!this.isInitialized) {
      return [];
    }

    return this.realm.objects('WebhookSubscription');
  }

  // Agregar nueva suscripción
  async addSubscription(event, url, secret = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const nextId = this.getNextId('WebhookSubscription');
    
    this.realm.write(() => {
      this.realm.create('WebhookSubscription', {
        id: nextId,
        event,
        url,
        secret,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    console.log(`✅ Suscripción agregada: ${event} -> ${url}`);
  }

  // Eliminar suscripción
  async removeSubscription(subscriptionId) {
    const subscription = this.realm.objectForPrimaryKey('WebhookSubscription', subscriptionId);
    if (subscription) {
      this.realm.write(() => {
        this.realm.delete(subscription);
      });
      console.log(`✅ Suscripción eliminada: ${subscriptionId}`);
    }
  }

  // Activar/desactivar suscripción
  async toggleSubscription(subscriptionId, isActive) {
    const subscription = this.realm.objectForPrimaryKey('WebhookSubscription', subscriptionId);
    if (subscription) {
      this.realm.write(() => {
        subscription.isActive = isActive;
        subscription.updatedAt = new Date();
      });
      console.log(`✅ Suscripción ${subscriptionId} ${isActive ? 'activada' : 'desactivada'}`);
    }
  }

  // Obtener estadísticas
  getStats() {
    if (!this.isInitialized) {
      return { total: 0, success: 0, failed: 0 };
    }

    const logs = this.realm.objects('WebhookLog');
    const success = logs.filtered('status = "success"').length;
    const failed = logs.filtered('status = "failed"').length;

    return {
      total: logs.length,
      success,
      failed,
      subscriptions: this.realm.objects('WebhookSubscription').length
    };
  }

  // Limpiar logs antiguos (más de 30 días)
  async cleanOldLogs() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const oldLogs = this.realm.objects('WebhookLog')
      .filtered('createdAt < $0', thirtyDaysAgo);

    if (oldLogs.length > 0) {
      this.realm.write(() => {
        this.realm.delete(oldLogs);
      });
      console.log(`🧹 ${oldLogs.length} logs antiguos eliminados`);
    }
  }

  // Función de utilidad para delays
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cerrar conexión a Realm
  close() {
    if (this.realm && !this.realm.isClosed) {
      this.realm.close();
      console.log('🔒 Conexión a Realm cerrada');
    }
  }
}

export default new WebhookService();
