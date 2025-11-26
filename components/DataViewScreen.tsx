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
import { Icon } from 'react-native-elements';
import FullSyncService from '../services/FullSyncService';
import Realm from 'realm';
import { SyncLogSchema } from '../services/RealmSchemas';
import {
  COLORS,
  SPACING,
  SHADOWS,
  BORDER_RADIUS,
  TYPOGRAPHY,
} from '../theme/theme';

type EntityType =
  | 'ventas'
  | 'usuarios'
  | 'productos'
  | 'precios'
  | 'inventario'
  | 'cartera'
  | 'clientes'
  | 'syncLogs';

interface EntityTab {
  key: EntityType;
  title: string;
  icon: string;
}

const ENTITY_TABS: EntityTab[] = [
  { key: 'syncLogs', title: 'Logs Sync', icon: 'sync' },
  { key: 'ventas', title: 'Ventas', icon: 'attach-money' },
  { key: 'clientes', title: 'Clientes', icon: 'people' },
  { key: 'productos', title: 'Productos', icon: 'inventory' },
  { key: 'precios', title: 'Precios', icon: 'price-check' },
  { key: 'inventario', title: 'Inventario', icon: 'bar-chart' },
  { key: 'cartera', title: 'Cartera', icon: 'account-balance-wallet' },
  { key: 'usuarios', title: 'Usuarios', icon: 'person' },
];

export default function DataViewScreen() {
  const [selectedTab, setSelectedTab] = useState<EntityType>('syncLogs');
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const ITEMS_PER_PAGE = 50;

  const loadData = useCallback(async () => {
    try {
      await FullSyncService.initialize();

      const newStats = FullSyncService.getStats();
      setStats(newStats);

      const offset = currentPage * ITEMS_PER_PAGE;

      switch (selectedTab) {
        case 'syncLogs':
          const realm = await Realm.open({
            schema: [SyncLogSchema],
            schemaVersion: 1,
          });
          const logsRealm = realm
            .objects('SyncLog')
            .sorted('fechaInicio', true)
            .slice(offset, offset + ITEMS_PER_PAGE);

          // Convertir objetos de Realm a objetos JavaScript planos
          const logs = Array.from(logsRealm).map((log: any) => ({
            id: log.id,
            fechaInicio: log.fechaInicio ? new Date(log.fechaInicio) : null,
            fechaFinal: log.fechaFinal ? new Date(log.fechaFinal) : null,
            exitoso: log.exitoso,
            razon: log.razon,
            usuario: log.usuario,
            ruta: log.ruta,
            sucursal: log.sucursal,
            totalRegistros: log.totalRegistros,
            duracionMs: log.duracionMs,
            tipo: log.tipo,
            detalles: log.detalles,
          }));

          realm.close();
          setData(logs);
          break;
        case 'ventas':
          setData(FullSyncService.getVentasPaginated(offset, ITEMS_PER_PAGE));
          break;
        case 'usuarios':
          setData(FullSyncService.getUsuariosPaginated(offset, ITEMS_PER_PAGE));
          break;
        case 'productos':
          setData(
            FullSyncService.getProductosPaginated(offset, ITEMS_PER_PAGE),
          );
          break;
        case 'precios':
          setData(FullSyncService.getPreciosPaginated(offset, ITEMS_PER_PAGE));
          break;
        case 'inventario':
          setData(
            FullSyncService.getInventarioPaginated(offset, ITEMS_PER_PAGE),
          );
          break;
        case 'cartera':
          setData(FullSyncService.getCarteraPaginated(offset, ITEMS_PER_PAGE));
          break;
        case 'clientes':
          setData(
            FullSyncService.getClientesFullPaginated(offset, ITEMS_PER_PAGE),
          );
          break;
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
    }
  }, [selectedTab, currentPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleTabChange = (tab: EntityType) => {
    setSelectedTab(tab);
    setCurrentPage(0);
  };

  const handleNextPage = () => {
    const totalRecords = getCount();
    const maxPage = Math.ceil(totalRecords / ITEMS_PER_PAGE) - 1;
    if (currentPage < maxPage) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const renderVenta = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => console.log(item)}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Venta #{item.noVenta}</Text>
          <Text style={styles.cardSubtitle}>
            {item.fecha?.toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardText}>Cliente: {item.nombreCliente}</Text>
          <Text style={styles.cardText}>Producto: {item.nombreProducto}</Text>
          <Text style={styles.cardText}>Cantidad: {item.cantProducto}</Text>
          <Text style={styles.cardPrice}>
            Importe: ${item.importe?.toFixed(2)}
          </Text>
          <Text style={styles.cardText}>Vendedor: {item.vendedor}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderCliente = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => console.log(item)}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.nombre}</Text>
          <Text style={styles.cardSubtitle}>ID: {item.id}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardText}>Grupo: {item.idGrupo || 'N/A'}</Text>
          <Text style={styles.cardText}>
            Crédito: {item.credito ? 'Sí' : 'No'}
          </Text>
          <Text style={styles.cardText}>
            Facturación móvil: {item.facturacionMovil ? 'Sí' : 'No'}
          </Text>
          {item.latitud && item.longitud ? (
            <Text style={styles.cardText}>
              Ubicación: {item.latitud.toFixed(4)}, {item.longitud.toFixed(4)}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderProducto = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => console.log(item)}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.descripcion}</Text>
          <Text style={styles.cardSubtitle}>Clave: {item.claveProd}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardText}>ID: {item.id}</Text>
          <Text style={styles.cardText}>
            Es Kit: {item.esKit ? 'Sí' : 'No'}
          </Text>
          <Text style={styles.cardText}>
            Actualizado: {item.fechaAct?.toLocaleDateString() || 'N/A'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderPrecio = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => console.log(item)}>
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
    </TouchableOpacity>
  );

  const renderInventario = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => console.log(item)}>
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
    </TouchableOpacity>
  );

  const renderCartera = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => console.log(item)}>
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
    </TouchableOpacity>
  );

  const renderUsuario = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => console.log(item)}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.nombre}</Text>
          <Text style={styles.cardSubtitle}>{item.claveEmpleado}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardText}>Perfil: {item.descripcionPerfil}</Text>
          <Text style={styles.cardText}>Puesto: {item.descripcionPuesto}</Text>
          <Text style={styles.cardText}>
            Sucursal Origen: {item.sucursalOrigen}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSyncLog = ({ item }: { item: any }) => {
    const duracionSeg = item.duracionMs
      ? (item.duracionMs / 1000).toFixed(1)
      : 'N/A';
    const statusColor = item.exitoso ? COLORS.success : COLORS.error;
    const statusIcon = item.exitoso ? 'check-circle' : 'error';

    return (
      <TouchableOpacity onPress={() => console.log(item)}>
        <View
          style={[
            styles.card,
            { borderLeftWidth: 4, borderLeftColor: statusColor },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Icon
                name={statusIcon}
                type="material"
                color={statusColor}
                size={20}
              />
              <Text style={[styles.cardTitle, { color: statusColor }]}>
                {item.exitoso ? 'Exitoso' : 'Error'}
              </Text>
            </View>
            <Text style={styles.cardSubtitle}>
              {item.tipo === 'manual' ? '👤 Manual' : '🤖 Auto'}
            </Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardText}>
              📅 Inicio: {item.fechaInicio?.toLocaleString('es-MX')}
            </Text>
            {item.fechaFinal && (
              <Text style={styles.cardText}>
                🏁 Final: {item.fechaFinal?.toLocaleString('es-MX')}
              </Text>
            )}
            <Text style={styles.cardText}>⏱️ Duración: {duracionSeg}s</Text>
            <Text style={styles.cardText}>
              👤 Usuario: {item.usuario || 'N/A'}
            </Text>
            <Text style={styles.cardText}>
              🏢 Sucursal: {item.sucursal || 'N/A'}
            </Text>
            <Text style={styles.cardText}>
              📊 Registros: {item.totalRegistros || 0}
            </Text>
            {!item.exitoso && item.razon && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>❌ {item.razon}</Text>
              </View>
            )}
            {item.ruta && (
              <Text
                style={[styles.cardText, { fontSize: 11, color: COLORS.muted }]}
              >
                🌐 {item.ruta}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    switch (selectedTab) {
      case 'syncLogs':
        return renderSyncLog({ item });
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
            onPress={() => handleTabChange(tab.key)}
          >
            <Icon
              name={tab.icon}
              type="material"
              size={24}
              color={selectedTab === tab.key ? '#fff' : COLORS.textSecondary}
              style={styles.tabIcon}
            />
            <Text
              style={[
                styles.tabText,
                selectedTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.title}
            </Text>
            <View style={styles.badge}>
              <Text
                style={[
                  styles.badgeText,
                  selectedTab === tab.key
                    ? { color: COLORS.primary }
                    : { color: COLORS.textPrimary },
                ]}
              >
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

      {/* Pagination Controls */}
      <View style={styles.paginationContainer}>
        <TouchableOpacity
          style={[
            styles.paginationButton,
            currentPage === 0 && styles.paginationButtonDisabled,
          ]}
          onPress={handlePreviousPage}
          disabled={currentPage === 0}
        >
          <Icon
            name="chevron-left"
            type="material"
            color={currentPage === 0 ? COLORS.textSecondary : '#fff'}
            size={20}
          />
          <Text
            style={[
              styles.paginationButtonText,
              currentPage === 0 && { color: COLORS.textSecondary },
            ]}
          >
            Anterior
          </Text>
        </TouchableOpacity>
        <Text style={styles.paginationInfo}>
          Página {currentPage + 1} de{' '}
          {Math.ceil(getCount() / ITEMS_PER_PAGE) || 1}
        </Text>
        <TouchableOpacity
          style={[
            styles.paginationButton,
            currentPage >= Math.ceil(getCount() / ITEMS_PER_PAGE) - 1 &&
              styles.paginationButtonDisabled,
          ]}
          onPress={handleNextPage}
          disabled={currentPage >= Math.ceil(getCount() / ITEMS_PER_PAGE) - 1}
        >
          <Text
            style={[
              styles.paginationButtonText,
              currentPage >= Math.ceil(getCount() / ITEMS_PER_PAGE) - 1 && {
                color: COLORS.textSecondary,
              },
            ]}
          >
            Siguiente
          </Text>
          <Icon
            name="chevron-right"
            type="material"
            color={
              currentPage >= Math.ceil(getCount() / ITEMS_PER_PAGE) - 1
                ? COLORS.textSecondary
                : '#fff'
            }
            size={20}
          />
        </TouchableOpacity>
      </View>

      {/* Data List */}
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${selectedTab}-${item.id || index}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <TouchableOpacity onPress={() => console.log('refresh')}>
            <View style={styles.emptyContainer}>
              <Icon
                name="inbox"
                type="material"
                size={64}
                color={COLORS.muted}
                style={{ marginBottom: 16 }}
              />
              <Text style={styles.emptyText}>No hay datos sincronizados</Text>
              <Text style={styles.emptySubtext}>
                Inicia sesión nuevamente para sincronizar
              </Text>
            </View>
          </TouchableOpacity>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabsContainer: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    maxHeight: 100,
  },
  tabsContent: {
    paddingHorizontal: SPACING.s,
    paddingVertical: SPACING.s,
  },
  tab: {
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    marginHorizontal: 4,
    borderRadius: BORDER_RADIUS.m,
    backgroundColor: COLORS.background,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    ...SHADOWS.small,
  },
  tabIcon: {
    marginBottom: 4,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: '#FFF',
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  statsContainer: {
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  listContent: {
    padding: SPACING.m,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.l,
    padding: SPACING.m,
    marginBottom: SPACING.m,
    ...SHADOWS.small,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.s,
    paddingBottom: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    flex: 1,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    marginLeft: 8,
  },
  cardBody: {
    gap: 4,
  },
  cardText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.success,
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
    padding: SPACING.s,
    borderRadius: BORDER_RADIUS.s,
    marginTop: SPACING.s,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.error,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.muted,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  paginationButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.m,
    minWidth: 100,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  paginationButtonDisabled: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  paginationButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  paginationInfo: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});
