import WebhookManager from './WebhookManager';

class ClienteService {
  // Simular creación de cliente con webhook
  async crearCliente(clienteData) {
    try {
      // Simular la creación del cliente en tu backend
      console.log('📝 Creando cliente:', clienteData);
      
      // Aquí iría tu lógica real para crear el cliente
      // const response = await api.post('/clientes', clienteData);
      
      const nuevoCliente = {
        id: Math.floor(Math.random() * 1000) + 1,
        ...clienteData,
        fecha_alta: new Date().toISOString(),
        usuarioEjecuta: 1,
        ip: '192.168.1.100',
        dispositivo: 'Mobile App'
      };
      
      // Enviar webhook de notificación
      await WebhookManager.notifyClienteCreado(nuevoCliente);
      
      console.log('✅ Cliente creado y webhook enviado');
      return nuevoCliente;
      
    } catch (error) {
      console.error('❌ Error creando cliente:', error);
      throw error;
    }
  }

  // Simular actualización de cliente con webhook
  async actualizarCliente(clienteId, clienteData) {
    try {
      console.log('📝 Actualizando cliente:', clienteId, clienteData);
      
      // Aquí iría tu lógica real para actualizar el cliente
      // const response = await api.put(`/clientes/${clienteId}`, clienteData);
      
      const clienteActualizado = {
        id: clienteId,
        ...clienteData,
        fechaActualizacion: new Date().toISOString(),
        usuarioEjecuta: 1,
        ip: '192.168.1.100',
        dispositivo: 'Mobile App'
      };
      
      // Enviar webhook de notificación
      await WebhookManager.notifyClienteActualizado(clienteActualizado);
      
      console.log('✅ Cliente actualizado y webhook enviado');
      return clienteActualizado;
      
    } catch (error) {
      console.error('❌ Error actualizando cliente:', error);
      throw error;
    }
  }

  // Ejemplo de cómo integrar con tu API existente
  async crearClienteConAPI(clienteData) {
    try {
      // Llamar a tu API real
      const response = await fetch('http://10.0.2.2:5083/api/CatClientes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clienteData)
      });
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }
      
      const nuevoCliente = await response.json();
      
      // Enviar webhook con los datos reales
      await WebhookManager.notifyClienteCreado({
        ...nuevoCliente,
        usuarioEjecuta: 1,
        ip: 'Mobile App',
        dispositivo: 'React Native'
      });
      
      return nuevoCliente;
      
    } catch (error) {
      console.error('❌ Error en API:', error);
      throw error;
    }
  }
}

export default new ClienteService();
