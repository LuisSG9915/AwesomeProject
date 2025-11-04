class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 5000; // 5 segundos
    this.isConnecting = false;
    this.listeners = {};
    
    // Línea 11 - usa tu IP real
    this.url = 'ws://10.0.2.2:5084/ws'; // Para Android emulator (10.0.2.2 = host machine)
  }

  // Conectar al WebSocket
  connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    console.log('🔌 Conectando al WebSocket:', this.url);

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('✅ WebSocket conectado exitosamente');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 Mensaje recibido:', data);
          this.emit('message', data);
          
          // Emitir eventos específicos según el tipo de mensaje
          if (data.type) {
            this.emit(data.type, data);
          }
        } catch (error) {
          console.error('❌ Error parseando mensaje WebSocket:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ Error en WebSocket:', error);
        this.isConnecting = false;
        this.emit('error', error);
      };

      this.ws.onclose = (event) => {
        console.log('🔌 WebSocket desconectado:', event.code, event.reason);
        this.isConnecting = false;
        this.emit('disconnected', event);
        
        // Intentar reconectar automáticamente
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        }
      };

    } catch (error) {
      console.error('❌ Error creando WebSocket:', error);
      this.isConnecting = false;
      this.emit('error', error);
    }
  }

  // Intentar reconectar
  attemptReconnect() {
    this.reconnectAttempts++;
    console.log(`🔄 Intentando reconectar (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  // Desconectar
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
    console.log('🔌 WebSocket desconectado manualmente');
  }

  // Enviar mensaje
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        this.ws.send(message);
        console.log('📤 Mensaje enviado:', message);
        return true;
      } catch (error) {
        console.error('❌ Error enviando mensaje:', error);
        return false;
      }
    } else {
      console.warn('⚠️ WebSocket no está conectado');
      return false;
    }
  }

  // Event listeners
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  // Verificar estado de conexión
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  // Obtener estado de conexión
  getState() {
    if (!this.ws) return 'DISCONNECTED';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'OPEN';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }

  // Actualizar URL del servidor (útil para cambiar IP dinámicamente)
  updateUrl(newUrl) {
    this.url = newUrl;
    console.log('🔄 URL del WebSocket actualizada:', newUrl);
    
    // Si está conectado, reconectar con la nueva URL
    if (this.isConnected()) {
      this.disconnect();
      setTimeout(() => this.connect(), 1000);
    }
  }
}

export default new WebSocketService();
