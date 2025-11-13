import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import FullSyncService from '../services/FullSyncService';

type EntityType = 'ventas' | 'usuarios' | 'productos' | 'precios' | 'inventario' | 'cartera' | 'clientes';

interface EntityTab {
  key: EntityType;
  title: string;
  icon: string;
}

const ENTITY_TABS: EntityTab[] = [
  { key: 'ventas', title: 'Ventas', icon: '💰' },
  { key: 'clientes', title: 'Clientes', icon: '👥' },
  { key: 'productos', title: 'Productos', icon: '📦' },
  { key: 'precios', title: 'Precios', icon: '💵' },
  { key: 'inventario', title: 'Inventario', icon: '📊' },
  { key: 'cartera', title: 'Cartera', icon: '💳' },
  { key: 'usuarios', title: 'Usuarios', icon: '👤' },
];

export default function DataViewScreen() {
  const [selectedTab, setSelectedTab] = useState<EntityType>('ventas');
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      await FullSyncService.initialize();
      
      const newStats = FullSyncService.getStats();
      setStats(newStats);

      switch (selectedTab) {
        case 'ventas':
          setData(FullSyncService.getVentas(50));
          break;
        case 'usuarios':
          setData(FullSyncService.getUsuarios(50));
          break;
        case 'productos':
          setData(FullSyncService.getProductos(50));
          break;
        case 'precios':
          setData(FullSyncService.getPrecios(50));
          break;
        case 'inventario':
          setData(FullSyncService.getInventario(50));
          break;
        case 'cartera':
          setData(FullSyncService.getCartera(50));
          break;
        case 'clientes':
          setData(FullSyncService.getClientesFull(50));
          break;
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
    }
  }, [selectedTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const renderVenta = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Venta #{item.noVenta}</Text>
        <Text style={styles.cardSubtitle}>{item.fecha?.toLocaleDateString()}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardText}>Cliente: {item.nombreCliente}</Text>
        <Text style={styles.cardText}>Producto: {item.nombreProducto}</Text>
        <Text style={styles.cardText}>Cantidad: {item.cantProducto}</Text>
        <Text style={styles.cardPrice}>Importe: ${item.importe?.toFixed(2)}</Text>
        <Text style={styles.cardText}>Vendedor: {item.vendedor}</Text>
      </View>
    </View>
  );

  const renderCliente = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.nombre}</Text>
        <Text style={styles.cardSubtitle}>ID: {item.id}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardText}>Grupo: {item.idGrupo || 'N/A'}</Text>
        <Text style={styles.cardText}>Crédito: {item.credito ? 'Sí' : 'No'}</Text>
        <Text style={styles.cardText}>Facturación móvil: {item.facturacionMovil ? 'Sí' : 'No'}</Text>
        {item.latitud && item.longitud ? (
          <Text style={styles.cardText}>
            Ubicación: {item.latitud.toFixed(4)}, {item.longitud.toFixed(4)}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const renderProducto = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.descripcion}</Text>
        <Text style={styles.cardSubtitle}>Clave: {item.claveProd}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardText}>ID: {item.id}</Text>
        <Text style={styles.cardText}>Es Kit: {item.esKit ? 'Sí' : 'No'}</Text>
        <Text style={styles.cardText}>
          Actualizado: {item.fechaAct?.toLocaleDateString() || 'N/A'}
        </Text>
      </View>
    </View>
  );

  const renderPrecio = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.descripcion}</Text>
        <Text style={styles.cardPrice}>${item.precio?.toFixed(2)}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardText}>ID Cliente: {item.idCliente}</Text>
        <Text style={styles.cardText}>Clave Producto: {item.claveProd}</Text>
        <Text style={styles.cardText}>
          Actualizado: {item.fechaAct?.toLocaleDateString() || 'N/A'}
        </Text>
      </View>
    </View>
  );

  const renderInventario = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Producto {item.claveProd}</Text>
        <Text style={styles.cardSubtitle}>Sucursal {item.sucursal}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardText}>ID: {item.id}</Text>
        <Text style={styles.cardPrice}>Saldo: {item.saldo}</Text>
        <Text style={styles.cardText}>
          Fecha Arrastre: {item.fechaArrastre?.toLocaleString() || 'N/A'}
        </Text>
      </View>
    </View>
  );

  const renderCartera = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.nombreCliente}</Text>
        <Text style={styles.cardPrice}>${item.saldo?.toFixed(2)}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardText}>ID Cliente: {item.idCliente}</Text>
        <Text style={styles.cardText}>Sucursal: {item.sucursal}</Text>
        <Text style={styles.cardText}>No. Venta: {item.noVenta}</Text>
        <Text style={styles.cardText}>
          Fecha: {item.fecha?.toLocaleDateString() || 'N/A'}
        </Text>
      </View>
    </View>
  );

  const renderUsuario = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.nombre}</Text>
        <Text style={styles.cardSubtitle}>{item.claveEmpleado}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardText}>Perfil: {item.descripcionPerfil}</Text>
        <Text style={styles.cardText}>Puesto: {item.descripcionPuesto}</Text>
        <Text style={styles.cardText}>Sucursal Origen: {item.sucursalOrigen}</Text>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: any }) => {
    switch (selectedTab) {
      case 'ventas':
        return renderVenta({ item });
      case 'clientes':
        return renderCliente({ item });
      case 'productos':
        return renderProducto({ item });
      case 'precios':
        return renderPrecio({ item });
      case 'inventario':
        return renderInventario({ item });
      case 'cartera':
        return renderCartera({ item });
      case 'usuarios':
        return renderUsuario({ item });
      default:
        return null;
    }
  };

  const getCount = () => {
    switch (selectedTab) {
      case 'ventas':
        return stats.ventas || 0;
      case 'usuarios':
        return stats.usuarios || 0;
      case 'productos':
        return stats.productos || 0;
      case 'precios':
        return stats.precios || 0;
      case 'inventario':
        return stats.inventario || 0;
      case 'cartera':
        return stats.cartera || 0;
      case 'clientes':
        return stats.clientes || 0;
      default:
        return 0;
    }
  };

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {ENTITY_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, selectedTab === tab.key && styles.tabActive]}
            onPress={() => setSelectedTab(tab.key)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabText, selectedTab === tab.key && styles.tabTextActive]}>
              {tab.title}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {selectedTab === tab.key ? data.length : getCount()}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Stats Summary */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          Mostrando {data.length} de {getCount()} registros
        </Text>
      </View>

      {/* Data List */}
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${selectedTab}-${item.id || index}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No hay datos sincronizados</Text>
            <Text style={styles.emptySubtext}>
              Inicia sesión nuevamente para sincronizar
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  tabsContainer: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    maxHeight: 90,
  },
  tabsContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    minWidth: 100,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#1976D2',
  },
  tabIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#FFF',
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333',
  },
  statsContainer: {
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  statsText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  cardBody: {
    gap: 6,
  },
  cardText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
});
