import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  ScrollView
} from 'react-native';
import { Card, Button, Input, Icon, Badge } from 'react-native-elements';
import WebhookManager from '../services/WebhookManager';
import WebSocketService from '../services/WebSocketService';

const WebhookScreen = () => {
  const [logs, setLogs] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0, subscriptions: 0 });
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [realTimeMessages, setRealTimeMessages] = useState([]);
  const [wsStatus, setWsStatus] = useState('DISCONNECTED');
  const [newSubscription, setNewSubscription] = useState({
    event: '',
    url: '',
    secret: ''
  });

  useEffect(() => {
    loadData();
    initializeWebSocket();
    
    // Cleanup al desmontar
    return () => {
      WebSocketService.off('message', handleWebSocketMessage);
      WebSocketService.off('connected', handleWebSocketConnected);
      WebSocketService.off('disconnected', handleWebSocketDisconnected);
      WebSocketService.off('error', handleWebSocketError);
    };
  }, []);

  const initializeWebSocket = () => {
    // Configurar event listeners
    WebSocketService.on('message', handleWebSocketMessage);
    WebSocketService.on('connected', handleWebSocketConnected);
    WebSocketService.on('disconnected', handleWebSocketDisconnected);
    WebSocketService.on('error', handleWebSocketError);
    
    // Conectar al WebSocket
    WebSocketService.connect();
  };

  const handleWebSocketMessage = (data) => {
    console.log('📨 Mensaje WebSocket recibido:', data);
    
    // Agregar mensaje a la lista de mensajes en tiempo real
    const newMessage = {
      id: Date.now(),
      timestamp: new Date(),
      data: data,
      tipo: data.Tipo || data.tipo || 'unknown',
      mensaje: data.Mensaje || data.mensaje || 'Sin mensaje',
      timestamp_msg: data.Timestamp || data.timestamp || new Date().toISOString(),
      datos: data.Datos || data.datos || {}
    };
    
    setRealTimeMessages(prev => [newMessage, ...prev].slice(0, 50)); // Mantener últimos 50 mensajes
  };

  const handleWebSocketConnected = () => {
    console.log('✅ WebSocket conectado');
    setWsStatus('CONNECTED');
  };

  const handleWebSocketDisconnected = () => {
    console.log('🔌 WebSocket desconectado');
    setWsStatus('DISCONNECTED');
  };

  const handleWebSocketError = (error) => {
    console.error('❌ Error WebSocket:', error);
    setWsStatus('ERROR');
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsData, subscriptionsData, statsData] = await Promise.all([
        WebhookManager.getRecentLogs(),
        WebhookManager.getSubscriptions(),
        WebhookManager.getEstadisticas()
      ]);
      
      setLogs(logsData);
      setSubscriptions(subscriptionsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error cargando datos:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos de webhooks');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubscription = async () => {
    if (!newSubscription.event || !newSubscription.url) {
      Alert.alert('Error', 'Todos los campos son requeridos');
      return;
    }

    try {
      await WebhookManager.addSubscription(
        newSubscription.event,
        newSubscription.url,
        newSubscription.secret || null
      );
      
      setShowAddModal(false);
      setNewSubscription({ event: '', url: '', secret: '' });
      loadData();
      
      Alert.alert('Éxito', 'Suscripción agregada correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo agregar la suscripción');
    }
  };

  const handleToggleSubscription = async (subscriptionId, isActive) => {
    try {
      await WebhookManager.toggleSubscription(subscriptionId, isActive);
      loadData();
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar la suscripción');
    }
  };

  const handleDeleteSubscription = async (subscriptionId) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de eliminar esta suscripción?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await WebhookManager.removeSubscription(subscriptionId);
              loadData();
              Alert.alert('Éxito', 'Suscripción eliminada');
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar la suscripción');
            }
          }
        }
      ]
    );
  };

  const sendTestWebhook = async () => {
    try {
      const testData = {
        id: 999,
        nombre: 'Cliente de Prueba',
        email: 'test@example.com',
        telefono: '1234567890',
        fecha_alta: new Date().toISOString(),
        usuarioEjecuta: 1,
        ip: '192.168.1.100',
        dispositivo: 'Test'
      };

      await WebhookManager.notifyClienteCreado(testData);
      Alert.alert('Éxito', 'Webhook de prueba enviado');
      loadData();
    } catch (error) {
      Alert.alert('Error', 'No se pudo enviar el webhook de prueba');
    }
  };

  const renderLogItem = ({ item }) => (
    <Card containerStyle={styles.logCard}>
      <View style={styles.logHeader}>
        <View style={styles.logInfo}>
          <Text style={styles.logEvent}>{item.eventType}</Text>
          <Text style={styles.logUrl}>{item.url}</Text>
        </View>
        <Badge
          value={item.status}
          status={item.status === 'success' ? 'success' : 'error'}
          containerStyle={styles.statusBadge}
        />
      </View>
      
      <View style={styles.logDetails}>
        <Text style={styles.logText}>
          Estado: <Text style={styles.logStatus}>{item.responseCode || 'N/A'}</Text>
        </Text>
        <Text style={styles.logText}>
          Intentos: <Text style={styles.logAttempts}>{item.attempts}</Text>
        </Text>
        <Text style={styles.logText}>
          Fecha: <Text style={styles.logDate}>
            {new Date(item.createdAt).toLocaleString()}
          </Text>
        </Text>
      </View>
      
      {item.responseMessage && (
        <Text style={styles.responseMessage} numberOfLines={2}>
          {item.responseMessage}
        </Text>
      )}
    </Card>
  );

  const renderRealTimeMessage = ({ item }) => (
    <Card containerStyle={[styles.logCard, { backgroundColor: '#f8f9fa' }]}>
      <View style={styles.logHeader}>
        <View style={styles.logInfo}>
          <Text style={[styles.logEvent, { color: '#2196F3' }]}>
            {item.tipo.toUpperCase()}
          </Text>
          <Text style={styles.logUrl}>
            {item.timestamp_msg ? new Date(item.timestamp_msg).toLocaleTimeString() : new Date(item.timestamp).toLocaleTimeString()}
          </Text>
        </View>
        <Badge
          value="LIVE"
          status="success"
          containerStyle={styles.statusBadge}
        />
      </View>
      
      <View style={styles.logDetails}>
        <Text style={styles.logText}>
          <Text style={styles.logStatus}>{item.mensaje}</Text>
        </Text>
        
        {item.datos && (
          <View style={styles.dataContainer}>
            <Text style={styles.dataTitle}>📋 Datos:</Text>
            {item.datos.ClienteId && (
              <Text style={styles.logText}>
                ID: <Text style={styles.logStatus}>{item.datos.ClienteId}</Text>
              </Text>
            )}
            {item.datos.Nombre && (
              <Text style={styles.logText}>
                Cliente: <Text style={styles.logStatus}>{item.datos.Nombre}</Text>
              </Text>
            )}
            {item.datos.UsuarioEjecuta !== undefined && (
              <Text style={styles.logText}>
                Usuario: <Text style={styles.logStatus}>{item.datos.UsuarioEjecuta}</Text>
              </Text>
            )}
            {item.datos.Ip && (
              <Text style={styles.logText}>
                IP: <Text style={styles.logStatus}>{item.datos.Ip}</Text>
              </Text>
            )}
            {item.datos.Dispositivo && (
              <Text style={styles.logText}>
                Dispositivo: <Text style={styles.logStatus}>{item.datos.Dispositivo}</Text>
              </Text>
            )}
          </View>
        )}
      </View>
    </Card>
  );

  const renderSubscriptionItem = ({ item }) => (
    <Card containerStyle={styles.subscriptionCard}>
      <View style={styles.subscriptionHeader}>
        <View style={styles.subscriptionInfo}>
          <Text style={styles.subscriptionEvent}>{item.event}</Text>
          <Text style={styles.subscriptionUrl}>{item.url}</Text>
        </View>
        <TouchableOpacity
          style={[styles.toggleButton, item.isActive ? styles.activeButton : styles.inactiveButton]}
          onPress={() => handleToggleSubscription(item.id, !item.isActive)}
        >
          <Text style={styles.toggleButtonText}>
            {item.isActive ? 'Activo' : 'Inactivo'}
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.subscriptionActions}>
        <Text style={styles.subscriptionDate}>
          Creado: {new Date(item.createdAt).toLocaleDateString()}
        </Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteSubscription(item.id)}
        >
          <Icon name="delete" color="#ff4444" size={20} />
        </TouchableOpacity>
      </View>
    </Card>
  );

  return (
    <ScrollView style={styles.container} refreshControl={
      <RefreshControl refreshing={loading} onRefresh={loadData} />
    }>
      {/* Estadísticas */}
      <Card containerStyle={styles.statsCard}>
        <Text style={styles.statsTitle}>📊 Estadísticas</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{stats.success}</Text>
            <Text style={styles.statLabel}>Éxitos</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#f44336' }]}>{stats.failed}</Text>
            <Text style={styles.statLabel}>Fallos</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#2196F3' }]}>{stats.subscriptions}</Text>
            <Text style={styles.statLabel}>Suscripciones</Text>
          </View>
        </View>
      </Card>

      {/* Acciones */}
      <View style={styles.actionsContainer}>
        <Button
          title="📡 Enviar Webhook de Prueba"
          onPress={sendTestWebhook}
          buttonStyle={styles.testButton}
        />
        <Button
          title="➕ Agregar Suscripción"
          onPress={() => setShowAddModal(true)}
          buttonStyle={styles.addButton}
        />
      </View>

      {/* WebSocket Status y Mensajes en Tiempo Real */}
      <Card containerStyle={styles.sectionCard}>
        <View style={styles.wsHeader}>
          <Text style={styles.sectionTitle}>📡 Mensajes en Tiempo Real</Text>
          <View style={[styles.wsStatus, {
            backgroundColor: wsStatus === 'CONNECTED' ? '#4CAF50' : 
                           wsStatus === 'ERROR' ? '#f44336' : '#FF9800'
          }]}>
            <Text style={styles.wsStatusText}>
              {wsStatus === 'CONNECTED' ? '🟢 Conectado' : 
               wsStatus === 'ERROR' ? '🔴 Error' : '🟡 Desconectado'}
            </Text>
          </View>
        </View>
        
        <FlatList
          data={realTimeMessages}
          renderItem={renderRealTimeMessage}
          keyExtractor={item => item.id.toString()}
          nestedScrollEnabled
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {wsStatus === 'CONNECTED' ? '📡 Esperando mensajes...' : '🔌 Conectando al WebSocket...'}
            </Text>
          }
          style={{ maxHeight: 300 }}
        />
      </Card>

      {/* Suscripciones */}
      <Card containerStyle={styles.sectionCard}>
        <Text style={styles.sectionTitle}>🔗 Suscripciones Activas</Text>
        <FlatList
          data={subscriptions}
          renderItem={renderSubscriptionItem}
          keyExtractor={item => item.id.toString()}
          nestedScrollEnabled
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay suscripciones configuradas</Text>
          }
        />
      </Card>

      {/* Logs Recientes */}
      <Card containerStyle={styles.sectionCard}>
        <Text style={styles.sectionTitle}>📝 Logs Recientes</Text>
        <FlatList
          data={logs}
          renderItem={renderLogItem}
          keyExtractor={item => item.id.toString()}
          nestedScrollEnabled
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay logs recientes</Text>
          }
        />
      </Card>

      {/* Modal para agregar suscripción */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Agregar Nueva Suscripción</Text>
          
          <Input
            placeholder="Evento (ej: cliente_creado)"
            value={newSubscription.event}
            onChangeText={text => setNewSubscription({...newSubscription, event: text})}
            containerStyle={styles.input}
          />
          
          <Input
            placeholder="URL del Webhook"
            value={newSubscription.url}
            onChangeText={text => setNewSubscription({...newSubscription, url: text})}
            containerStyle={styles.input}
          />
          
          <Input
            placeholder="Secret (opcional)"
            value={newSubscription.secret}
            onChangeText={text => setNewSubscription({...newSubscription, secret: text})}
            containerStyle={styles.input}
            secureTextEntry
          />
          
          <View style={styles.modalActions}>
            <Button
              title="Cancelar"
              onPress={() => setShowAddModal(false)}
              buttonStyle={styles.cancelButton}
            />
            <Button
              title="Agregar"
              onPress={handleAddSubscription}
              buttonStyle={styles.confirmButton}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  statsCard: {
    margin: 10,
    backgroundColor: '#fff'
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center'
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  statItem: {
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333'
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 10
  },
  testButton: {
    backgroundColor: '#4CAF50',
    flex: 1,
    marginRight: 5,
    height: 40
  },
  addButton: {
    backgroundColor: '#2196F3',
    flex: 1,
    marginLeft: 5,
    height: 40
  },
  sectionCard: {
    margin: 10,
    backgroundColor: '#fff'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10
  },
  logCard: {
    marginHorizontal: 0,
    marginBottom: 10,
    padding: 10
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  logInfo: {
    flex: 1
  },
  logEvent: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333'
  },
  logUrl: {
    fontSize: 12,
    color: '#666',
    marginTop: 2
  },
  statusBadge: {
    marginLeft: 10
  },
  logDetails: {
    marginBottom: 5
  },
  logText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2
  },
  logStatus: {
    fontWeight: 'bold'
  },
  logAttempts: {
    fontWeight: 'bold'
  },
  logDate: {
    fontWeight: 'bold'
  },
  responseMessage: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic'
  },
  subscriptionCard: {
    marginHorizontal: 0,
    marginBottom: 10,
    padding: 10
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  subscriptionInfo: {
    flex: 1
  },
  subscriptionEvent: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333'
  },
  subscriptionUrl: {
    fontSize: 12,
    color: '#666',
    marginTop: 2
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15
  },
  activeButton: {
    backgroundColor: '#4CAF50'
  },
  inactiveButton: {
    backgroundColor: '#ccc'
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  subscriptionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  subscriptionDate: {
    fontSize: 11,
    color: '#999'
  },
  deleteButton: {
    padding: 5
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    padding: 20
  },
  modalContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30
  },
  input: {
    marginBottom: 15
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30
  },
  cancelButton: {
    backgroundColor: '#ccc',
    flex: 1,
    marginRight: 10
  },
  confirmButton: {
    backgroundColor: '#2196F3',
    flex: 1,
    marginLeft: 10
  },
  wsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  wsStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 120
  },
  wsStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  dataContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5
  },
  dataTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5
  }
});

export default WebhookScreen;
