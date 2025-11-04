import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { Card, Button, SearchBar, Icon, Badge } from 'react-native-elements';
import SyncService from '../services/SyncService';
import WebhookService from '../services/WebhookService';

const ClientesTable = () => {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ total: 0, lastSync: null, synced: 0 });
  const [selectedClient, setSelectedClient] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    try {
      await SyncService.initialize();
      const clientsList = SyncService.getClients();
      const syncStats = SyncService.getSyncStats();
      
      setClientes(clientsList);
      setStats(syncStats);
    } catch (error) {
      console.error('Error cargando datos:', error);
      Alert.alert('Error', 'No se pudieron cargar los clientes');
    }
  }, []);

  const handleSyncClients = useCallback(async () => {
    setLoading(true);
    
    try {
      const result = await SyncService.syncClients();
      
      if (result.success) {
        Alert.alert(
          '✅ Sincronización Exitosa',
          `${result.nuevos} nuevos clientes\n${result.actualizados} actualizados\n${result.eliminados} eliminados\nTotal: ${result.total}`,
          [{ text: 'OK', onPress: loadData }]
        );
      } else {
        Alert.alert('❌ Error de Sincronización', result.error);
      }
    } catch (error) {
      Alert.alert('❌ Error', 'No se pudo completar la sincronización');
    } finally {
      setLoading(false);
    }
  }, [loadData]);

  const handleSendClientViaWebhook = useCallback(async (client) => {
    Alert.alert(
      '📡 Enviar Cliente via Webhook',
      `¿Enviar el cliente "${client.nombre}" a través del webhook?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            try {
              // Configurar IP del servidor
              WebhookService.setProductionUrl('10.0.2.2'); // Para Android emulator
              
              // Preparar datos completos del cliente
              const clientData = {
                // Datos básicos
                nombre: client.nombre || '',
                domicilio: client.domicilio || '',
                ciudad: client.ciudad || '',
                estado: client.estado || '',
                telefono: client.telefono || '',
                email: client.email || '',
                rfc: client.rfc || '',
                cp: client.cp || '',
                colonia: client.colonia || '',
                
                // Datos fiscales
                nombreFiscal: client.nombre_fiscal || client.nombreFiscal || '',
                domicilioFiscal: client.domicilioFiscal || '',
                regimenFiscal: client.regimenFiscal || '',
                
                // Configuración
                credito: client.credito || false,
                limiteCredito: client.limiteCredito || 0,
                diasCredito: client.dias_Credito || 0,
                carteraMovil: client.carteraMovil || true,
                
                // Facturación
                usoCfdi: client.usoCFDI ? client.usoCFDI.toString() : '',
                metodoPago: client.metodoPago || ''
              };
              
              // Enviar cliente completo
              const result = await WebhookService.enviarClienteCreadoCompleto(
                clientData, 
                'mobile-app-user'
              );
              
              if (result.success && result.guardadoEnBD) {
                Alert.alert(
                  '✅ Cliente Enviado',
                  `Cliente guardado con ID: ${result.clienteIdGuardado}\n📱 Notificado a ${result.data.connectedClients} dispositivos`,
                  [{ text: 'OK' }]
                );
              } else {
                Alert.alert(
                  '⚠️ Envío Parcial',
                  'El cliente se envió pero no se guardó en la base de datos',
                  [{ text: 'OK' }]
                );
              }
            } catch (error) {
              console.error('Error enviando cliente via webhook:', error);
              Alert.alert(
                '❌ Error',
                'No se pudo enviar el cliente through webhook',
                [{ text: 'OK' }]
              );
            }
          }
        }
      ]
    );
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    const searchResults = SyncService.searchClients(query);
    setClientes(searchResults);
  }, []);

  const handleDeleteAll = useCallback(() => {
    Alert.alert(
      '⚠️ Confirmar Eliminación',
      '¿Estás seguro de eliminar todos los clientes locales? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            SyncService.clearAllClients();
            loadData();
            Alert.alert('✅ Eliminados', 'Todos los clientes han sido eliminados');
          }
        }
      ]
    );
  }, [loadData]);

  const renderClientItem = ({ item }) => (
    <TouchableOpacity
      style={styles.clientItem}
      onPress={() => setSelectedClient(item)}
    >
      <View style={styles.clientInfo}>
        <View style={styles.clientHeader}>
          <Text style={styles.clientName}>{item.nombre}</Text>
          <View style={styles.headerRight}>
            <Badge
              value={item.id}
              status="primary"
              containerStyle={styles.idBadge}
            />
            <TouchableOpacity
              style={styles.webhookButton}
              onPress={() => handleSendClientViaWebhook(item)}
            >
              <Icon
                name="send"
                type="font-awesome"
                size={16}
                color="#2196F3"
              />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.clientDetails}>
          {item.email && (
            <Text style={styles.detailText}>📧 {item.email}</Text>
          )}
          {item.telefono && (
            <Text style={styles.detailText}>📱 {item.telefono}</Text>
          )}
          {item.ciudad && (
            <Text style={styles.detailText}>📍 {item.ciudad}, {item.estado || ''}</Text>
          )}
          {item.rfc && (
            <Text style={styles.detailText}>🆔 RFC: {item.rfc}</Text>
          )}
        </View>
        
        <View style={styles.clientFooter}>
          <Text style={styles.syncText}>
            Sync: {item.syncedAt ? new Date(item.syncedAt).toLocaleDateString() : 'Nunca'}
          </Text>
          <View style={[styles.statusIndicator, item.suspendido ? styles.suspended : styles.active]} />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <Card containerStyle={styles.statsCard}>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{stats.synced}</Text>
          <Text style={styles.statLabel}>Sincronizados</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#2196F3' }]}>
            {stats.total - stats.synced}
          </Text>
          <Text style={styles.statLabel}>Locales</Text>
        </View>
      </View>
      
      {stats.lastSync && (
        <Text style={styles.lastSyncText}>
          Última sincronización: {new Date(stats.lastSync).toLocaleString()}
        </Text>
      )}
    </Card>
  );

  return (
    <View style={styles.container}>
      {/* Botones de acción */}
      <View style={styles.actionsContainer}>
        <Button
          title="🔄 Sincronizar Clientes"
          onPress={handleSyncClients}
          loading={loading}
          buttonStyle={styles.syncButton}
          disabled={loading}
        />
        <Button
          title="🗑️ Eliminar Todo"
          onPress={handleDeleteAll}
          buttonStyle={styles.deleteButton}
          type="outline"
        />
      </View>

      {/* Búsqueda */}
      <Card containerStyle={styles.searchCard}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Buscar cliente por nombre..."
          value={searchQuery}
          onChangeText={handleSearch}
          clearButtonMode="while-editing"
        />
      </Card>

      {/* Lista de clientes */}
      <FlatList
        ListHeaderComponent={renderHeader}
        data={clientes}
        renderItem={renderClientItem}
        keyExtractor={item => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="people-outline" type="ionicon" size={60} color="#ccc" />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No se encontraron clientes' : 'No hay clientes sincronizados'}
            </Text>
            {!searchQuery && (
              <Button
                title="Sincronizar Ahora"
                onPress={handleSyncClients}
                buttonStyle={styles.emptyButton}
              />
            )}
          </View>
        }
        contentContainerStyle={styles.listContainer}
      />

      {/* Modal de detalles del cliente */}
      {selectedClient && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalles del Cliente</Text>
              <TouchableOpacity onPress={() => setSelectedClient(null)}>
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <Text style={styles.detailLabel}>ID:</Text>
              <Text style={styles.detailValue}>{selectedClient.id}</Text>
              
              <Text style={styles.detailLabel}>Nombre:</Text>
              <Text style={styles.detailValue}>{selectedClient.nombre}</Text>
              
              <Text style={styles.detailLabel}>Email:</Text>
              <Text style={styles.detailValue}>{selectedClient.email || 'N/A'}</Text>
              
              <Text style={styles.detailLabel}>Teléfono:</Text>
              <Text style={styles.detailValue}>{selectedClient.telefono || 'N/A'}</Text>
              
              <Text style={styles.detailLabel}>Domicilio:</Text>
              <Text style={styles.detailValue}>
                {selectedClient.domicilio || 'N/A'}
                {selectedClient.ciudad && `, ${selectedClient.ciudad}`}
                {selectedClient.estado && `, ${selectedClient.estado}`}
                {selectedClient.cp && ` CP: ${selectedClient.cp}`}
              </Text>
              
              <Text style={styles.detailLabel}>RFC:</Text>
              <Text style={styles.detailValue}>{selectedClient.rfc || 'N/A'}</Text>
              
              <Text style={styles.detailLabel}>Estado:</Text>
              <Text style={[styles.detailValue, selectedClient.suspendido ? styles.suspendedText : styles.activeText]}>
                {selectedClient.suspendido ? 'Suspendido' : 'Activo'}
              </Text>
              
              <Text style={styles.detailLabel}>Fecha de Alta:</Text>
              <Text style={styles.detailValue}>
                {selectedClient.fecha_alta ? 
                  new Date(selectedClient.fecha_alta).toLocaleDateString() : 'N/A'}
              </Text>
              
              <Text style={styles.detailLabel}>Última Sincronización:</Text>
              <Text style={styles.detailValue}>
                {selectedClient.syncedAt ? 
                  new Date(selectedClient.syncedAt).toLocaleString() : 'Nunca'}
              </Text>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 5
  },
  syncButton: {
    backgroundColor: '#4CAF50',
    flex: 1,
    marginRight: 5,
    height: 40
  },
  deleteButton: {
    borderColor: '#f44336',
    flex: 1,
    marginLeft: 5,
    height: 40
  },
  searchCard: {
    marginHorizontal: 15,
    marginVertical: 5,
    padding: 10
  },
  searchInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16
  },
  statsCard: {
    marginHorizontal: 15,
    marginVertical: 5,
    padding: 15
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10
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
  lastSyncText: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic'
  },
  listContainer: {
    paddingHorizontal: 15
  },
  clientItem: {
    backgroundColor: '#fff',
    marginBottom: 10,
    borderRadius: 8,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  clientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  clientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1
  },
  idBadge: {
    marginLeft: 10
  },
  clientDetails: {
    marginBottom: 8
  },
  detailText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2
  },
  clientFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  syncText: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic'
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  active: {
    backgroundColor: '#4CAF50'
  },
  suspended: {
    backgroundColor: '#f44336'
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20
  },
  emptyButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 10,
    maxHeight: '80%',
    width: '90%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  modalBody: {
    padding: 20
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5
  },
  activeText: {
    color: '#4CAF50',
    fontWeight: 'bold'
  },
  suspendedText: {
    color: '#f44336',
    fontWeight: 'bold'
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  webhookButton: {
    backgroundColor: '#E3F2FD',
    borderRadius: 20,
    padding: 8,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#2196F3'
  }
});

export default ClientesTable;
