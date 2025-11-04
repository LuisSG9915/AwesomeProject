import WebhookService from './WebhookService';

class WebhookManager {
  constructor() {
    this.isInitialized = false;
  }

  // Inicializar el sistema de webhooks
  async initialize() {
    try {
      await WebhookService.initialize();
      this.isInitialized = true;
      console.log('🚀 WebhookManager inicializado');
      
      // Limpiar logs antiguos cada 24 horas
      setInterval(() => {
        WebhookService.cleanOldLogs();
      }, 24 * 60 * 60 * 1000);
      
    } catch (error) {
      console.error('❌ Error inicializando WebhookManager:', error);
      throw error;
    }
  }

  // Notificar creación de cliente
  async notifyClienteCreado(clienteData) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const payload = {
      tipo: 'cliente_creado',
      mensaje: `Nuevo cliente creado: ${clienteData.nombre}`,
      datos: {
        clienteId: clienteData.id,
        nombre: clienteData.nombre,
        email: clienteData.email,
        telefono: clienteData.telefono,
        fechaAlta: clienteData.fecha_alta,
        usuarioEjecuta: clienteData.usuarioEjecuta || 1,
        ip: clienteData.ip || 'App',
        dispositivo: clienteData.dispositivo || 'Mobile'
      }
    };

    await WebhookService.sendWebhook('cliente_creado', payload);
  }

  // Notificar actualización de cliente
  async notifyClienteActualizado(clienteData) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const payload = {
      tipo: 'cliente_actualizado',
      mensaje: `Cliente actualizado: ${clienteData.nombre}`,
      datos: {
        clienteId: clienteData.id,
        nombre: clienteData.nombre,
        email: clienteData.email,
        telefono: clienteData.telefono,
        fechaActualizacion: new Date().toISOString(),
        usuarioEjecuta: clienteData.usuarioEjecuta || 1,
        ip: clienteData.ip || 'App',
        dispositivo: clienteData.dispositivo || 'Mobile'
      }
    };

    await WebhookService.sendWebhook('cliente_actualizado', payload);
  }

  // Notificar creación de venta
  async notifyVentaCreada(ventaData) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const payload = {
      tipo: 'venta_creada',
      mensaje: `Nueva venta creada: ${ventaData.folio}`,
      datos: {
        ventaId: ventaData.id,
        folio: ventaData.folio,
        clienteId: ventaData.clienteId,
        clienteNombre: ventaData.clienteNombre,
        total: ventaData.total,
        fecha: ventaData.fecha,
        usuarioEjecuta: ventaData.usuarioEjecuta || 1,
        sucursal: ventaData.sucursal || 1
      }
    };

    await WebhookService.sendWebhook('venta_creada', payload);
  }

  // Notificar actualización de inventario
  async notifyInventarioActualizado(productoData) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const payload = {
      tipo: 'inventario_actualizado',
      mensaje: `Inventario actualizado: ${productoData.nombre}`,
      datos: {
        productoId: productoData.id,
        nombre: productoData.nombre,
        sku: productoData.sku,
        stockAnterior: productoData.stockAnterior,
        stockNuevo: productoData.stockNuevo,
        diferencia: productoData.stockNuevo - productoData.stockAnterior,
        fechaActualizacion: new Date().toISOString(),
        usuarioEjecuta: productoData.usuarioEjecuta || 1
      }
    };

    await WebhookService.sendWebhook('inventario_actualizado', payload);
  }

  // Notificar pago creado
  async notifyPagoCreado(pagoData) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const payload = {
      tipo: 'pago_creado',
      mensaje: `Nuevo pago registrado: ${pagoData.referencia}`,
      datos: {
        pagoId: pagoData.id,
        ventaId: pagoData.ventaId,
        clienteId: pagoData.clienteId,
        monto: pagoData.monto,
        metodoPago: pagoData.metodoPago,
        fechaPago: pagoData.fechaPago,
        referencia: pagoData.referencia,
        usuarioEjecuta: pagoData.usuarioEjecuta || 1
      }
    };

    await WebhookService.sendWebhook('pago_creado', payload);
  }

  // Notificar evento personalizado
  async notifyCustomEvent(eventType, data) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const payload = {
      tipo: eventType,
      mensaje: data.mensaje || `Evento: ${eventType}`,
      datos: data,
      timestamp: new Date().toISOString()
    };

    await WebhookService.sendWebhook(eventType, payload);
  }

  // Obtener logs recientes
  getRecentLogs(limit = 20) {
    return WebhookService.getWebhookLogs(limit);
  }

  // Obtener estadísticas
  getEstadisticas() {
    return WebhookService.getStats();
  }

  // Agregar suscripción
  async addSubscription(event, url, secret = null) {
    return await WebhookService.addSubscription(event, url, secret);
  }

  // Obtener suscripciones
  getSubscriptions() {
    return WebhookService.getSubscriptions();
  }

  // Eliminar suscripción
  async removeSubscription(subscriptionId) {
    return await WebhookService.removeSubscription(subscriptionId);
  }

  // Activar/desactivar suscripción
  async toggleSubscription(subscriptionId, isActive) {
    return await WebhookService.toggleSubscription(subscriptionId, isActive);
  }
}

export default new WebhookManager();
