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
  TextInput,
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
  | 'syncLogs'
  | 'bitacora';

interface EntityTab {
  key: EntityType;
  title: string;
  icon: string;
}

const ENTITY_TABS: EntityTab[] = [
  { key: 'syncLogs', title: 'Logs Sync', icon: 'sync' },
  { key: 'bitacora', title: 'Bitácora', icon: 'history' },
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
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const ITEMS_PER_PAGE = 50;

  const loadData = useCallback(async () => {
    try {
      await FullSyncService.initialize();

      const newStats = FullSyncService.getStats();
      setStats(newStats);

      const offset = currentPage * ITEMS_PER_PAGE;
      const shouldLoadAllData = searchQuery.trim().length > 0;

      switch (selectedTab) {
        case 'syncLogs':
          const realm = await Realm.open({
            schema: [SyncLogSchema],
            schemaVersion: 1,
          });
          const logsRealm = realm
            .objects('SyncLog')
            .sorted('fechaInicio', true);

          const logsToSlice = shouldLoadAllData
            ? logsRealm
            : logsRealm.slice(offset, offset + ITEMS_PER_PAGE);

          // Convertir objetos de Realm a objetos JavaScript planos
          const logs = Array.from(logsToSlice).map((log: any) => ({
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
          setFilteredData(logs);
          break;
        case 'ventas':
          const ventasData = shouldLoadAllData
            ? FullSyncService.getVentas(999999)
            : FullSyncService.getVentasPaginated(offset, ITEMS_PER_PAGE);
          setData(ventasData);
          setFilteredData(ventasData);
          break;
        case 'usuarios':
          const usuariosData = shouldLoadAllData
            ? FullSyncService.getUsuarios(999999)
            : FullSyncService.getUsuariosPaginated(offset, ITEMS_PER_PAGE);
          setData(usuariosData);
          setFilteredData(usuariosData);
          break;
        case 'productos':
          const productosData = shouldLoadAllData
            ? FullSyncService.getProductos(999999)
            : FullSyncService.getProductosPaginated(offset, ITEMS_PER_PAGE);
          setData(productosData);
          setFilteredData(productosData);
          break;
        case 'precios':
          const preciosData = shouldLoadAllData
            ? FullSyncService.getPrecios(999999)
            : FullSyncService.getPreciosPaginated(offset, ITEMS_PER_PAGE);
          setData(preciosData);
          setFilteredData(preciosData);
          break;
        case 'inventario':
          const inventarioData = shouldLoadAllData
            ? FullSyncService.getInventario(999999)
            : FullSyncService.getInventarioPaginated(offset, ITEMS_PER_PAGE);
          setData(inventarioData);
          setFilteredData(inventarioData);
          break;
        case 'cartera':
          const carteraData = shouldLoadAllData
            ? FullSyncService.getCartera(999999)
            : FullSyncService.getCarteraPaginated(offset, ITEMS_PER_PAGE);
          setData(carteraData);
          setFilteredData(carteraData);
          break;
        case 'clientes':
          const clientesData = shouldLoadAllData
            ? FullSyncService.getClientesFull(999999)
            : FullSyncService.getClientesFullPaginated(offset, ITEMS_PER_PAGE);
          setData(clientesData);
          setFilteredData(clientesData);
          break;
        case 'bitacora':
          // Para bitácora, necesitamos verificar si hay un método que obtenga todos los datos
          const bitacoraData = shouldLoadAllData
            ? FullSyncService.getSyncTableLogsPaginated(0, 999999)
            : FullSyncService.getSyncTableLogsPaginated(offset, ITEMS_PER_PAGE);
          setData(bitacoraData);
          setFilteredData(bitacoraData);
          break;
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
    }
  }, [selectedTab, currentPage, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Search filtering logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredData(data);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = data.filter((item: any) => {
      switch (selectedTab) {
        case 'ventas':
          return (
            item.id?.toString().includes(query) ||
            item.noVenta?.toString().includes(query) ||
            item.nombreCliente?.toLowerCase().includes(query) ||
            item.nombreProducto?.toLowerCase().includes(query) ||
            item.vendedor?.toLowerCase().includes(query)
          );
        case 'clientes':
          return (
            item.id?.toString().includes(query) ||
            item.nombre?.toLowerCase().includes(query) ||
            item.idGrupo?.toString().includes(query)
          );
        case 'productos':
          return (
            item.id?.toString().includes(query) ||
            item.descripcion?.toLowerCase().includes(query) ||
            item.claveProd?.toLowerCase().includes(query)
          );
        case 'precios':
          return (
            item.id?.toString().includes(query) ||
            item.descripcion?.toLowerCase().includes(query) ||
            // item.claveProd?.toLowerCase().includes(query) ||
            item.idCliente?.toString().includes(query)
          );
        case 'inventario':
          return (
            item.id?.toString().includes(query) ||
            item.claveProd?.toLowerCase().includes(query) ||
            item.sucursal?.toString().includes(query)
          );
        case 'cartera':
          return (
            item.id?.toString().includes(query) ||
            item.nombreCliente?.toLowerCase().includes(query) ||
            item.idCliente?.toString().includes(query) ||
            item.noVenta?.toString().includes(query)
          );
        case 'usuarios':
          return (
            item.id?.toString().includes(query) ||
            item.nombre?.toLowerCase().includes(query) ||
            item.claveEmpleado?.toLowerCase().includes(query) ||
            item.descripcionPerfil?.toLowerCase().includes(query)
          );
        case 'syncLogs':
          return (
            item.id?.toString().includes(query) ||
            item.usuario?.toLowerCase().includes(query) ||
            item.sucursal?.toLowerCase().includes(query) ||
            item.ruta?.toLowerCase().includes(query) ||
            item.tipo?.toLowerCase().includes(query)
          );
        case 'bitacora':
          return (
            item.id?.toString().includes(query) ||
            item.tabla?.toLowerCase().includes(query) ||
            item.endpoint?.toLowerCase().includes(query)
          );
        default:
          return false;
      }
    });

    setFilteredData(filtered);
  }, [searchQuery, data, selectedTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleTabChange = (tab: EntityType) => {
    setSelectedTab(tab);
    setCurrentPage(0);
    setSearchQuery('');
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

  const handleDelete = async (id: number | string, type: EntityType) => {
    return;
    Alert.alert(
      'Confirmar eliminación',
      `¿Estás seguro de que deseas eliminar este registro?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              let success = false;

              switch (type) {
                case 'ventas':
                  success = FullSyncService.deleteVenta(id as number);
                  break;
                case 'clientes':
                  success = FullSyncService.deleteCliente(id as number);
                  break;
                case 'productos':
                  success = FullSyncService.deleteProducto(id as number);
                  break;
                case 'precios':
                  success = FullSyncService.deletePrecio(id as number);
                  break;
                case 'inventario':
                  success = FullSyncService.deleteInventario(id as number);
                  break;
                case 'cartera':
                  success = FullSyncService.deleteCartera(id as number);
                  break;
                case 'usuarios':
                  success = FullSyncService.deleteUsuario(id as number);
                  break;
                case 'syncLogs':
                  success = await FullSyncService.deleteSyncLog(id as string);
                  break;
                case 'bitacora':
                  success = FullSyncService.deleteSyncTableLog(id as string);
                  break;
              }

              if (success) {
                Alert.alert('Éxito', 'Registro eliminado correctamente');
                await loadData();
              } else {
                Alert.alert('Error', 'No se pudo eliminar el registro');
              }
            } catch (error) {
              console.error('Error al eliminar:', error);
              Alert.alert('Error', 'Ocurrió un error al eliminar el registro');
            }
          },
        },
      ],
    );
  };

  const handleDeleteAll = async () => {
    return;
    const count = getCount();
    if (count === 0) {
      Alert.alert('Información', 'No hay registros para eliminar');
      return;
    }

    Alert.alert(
      '⚠️ ADVERTENCIA',
      `¿Estás COMPLETAMENTE SEGURO de que deseas eliminar TODOS los ${count} registros de ${
        ENTITY_TABS.find(t => t.key === selectedTab)?.title
      }?\n\nEsta acción NO se puede deshacer.`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'SÍ, ELIMINAR TODO',
          style: 'destructive',
          onPress: async () => {
            try {
              let success = false;

              switch (selectedTab) {
                case 'ventas':
                  success = FullSyncService.deleteAllVentas();
                  break;
                case 'clientes':
                  success = FullSyncService.deleteAllClientes();
                  break;
                case 'productos':
                  success = FullSyncService.deleteAllProductos();
                  break;
                case 'precios':
                  success = FullSyncService.deleteAllPrecios();
                  break;
                case 'inventario':
                  success = FullSyncService.deleteAllInventario();
                  break;
                case 'cartera':
                  success = FullSyncService.deleteAllCartera();
                  break;
                case 'usuarios':
                  success = FullSyncService.deleteAllUsuarios();
                  break;
                case 'syncLogs':
                  success = await FullSyncService.deleteAllSyncLogs();
                  break;
                case 'bitacora':
                  success = FullSyncService.deleteAllSyncTableLogs();
                  break;
              }

              if (success) {
                Alert.alert(
                  '✅ Éxito',
                  `Todos los registros de ${
                    ENTITY_TABS.find(t => t.key === selectedTab)?.title
                  } han sido eliminados`,
                );
                await loadData();
              } else {
                Alert.alert('Error', 'No se pudieron eliminar los registros');
              }
            } catch (error) {
              console.error('Error al eliminar todos:', error);
              Alert.alert(
                'Error',
                'Ocurrió un error al eliminar los registros',
              );
            }
          },
        },
      ],
    );
  };

  const renderVenta = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => console.log('ventas', item)}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>ID #{item.id}</Text>
            <Text style={styles.cardTitle}>Venta #{item.noVenta}</Text>
            <Text style={styles.cardSubtitle}>
              {item.fecha?.toLocaleDateString()}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDelete(item.id, 'ventas')}
            style={styles.deleteButton}
          >
            <Icon
              name="delete"
              type="material"
              color={COLORS.error}
              size={24}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardText}>Cliente: {item.nombreCliente}</Text>
          <Text style={styles.cardText}>Producto: {item.nombreProducto}</Text>
          <Text style={styles.cardText}>Cantidad: {item.cantProducto}</Text>
          <Text style={styles.cardPrice}>
            Importe: ${item.importe?.toFixed(2)}
          </Text>
          <Text style={styles.cardText}>Vendedor: {item.vendedor}</Text>
          {item.syncedAr && (
            <Text style={styles.cardText}>
              Sync (MX): {item.syncedAr.toLocaleString('es-MX')}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderCliente = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => consoleRealm('cliente', item)}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.nombre}</Text>
            <Text style={styles.cardSubtitle}>ID: {item.id}</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDelete(item.id, 'clientes')}
            style={styles.deleteButton}
          >
            <Icon
              name="delete"
              type="material"
              color={COLORS.error}
              size={24}
            />
          </TouchableOpacity>
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
          {item.syncedAr && (
            <Text style={styles.cardText}>
              Sync (MX): {item.syncedAr.toLocaleString('es-MX')}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderProducto = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.descripcion}</Text>
          <Text style={styles.cardSubtitle}>Clave: {item.claveProd}</Text>
        </View>
        <TouchableOpacity
          onPress={() => handleDelete(item.id, 'productos')}
          style={styles.deleteButton}
        >
          <Icon name="delete" type="material" color={COLORS.error} size={24} />
        </TouchableOpacity>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardText}>ID: {item.id}</Text>
        <Text style={styles.cardText}>Es Kit: {item.esKit ? 'Sí' : 'No'}</Text>
        <Text style={styles.cardText}>
          Actualizado: {item.fechaAct?.toLocaleDateString() || 'N/A'}
        </Text>
        {item.syncedAr && (
          <Text style={styles.cardText}>
            Sync (MX): {item.syncedAr.toLocaleString('es-MX')}
          </Text>
        )}
      </View>
    </View>
  );

  const renderPrecio = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => consoleRealm('precio', item)}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.descripcion}</Text>
            <Text style={styles.cardPrice}>${item.precio?.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDelete(item.id, 'precios')}
            style={styles.deleteButton}
          >
            <Icon
              name="delete"
              type="material"
              color={COLORS.error}
              size={24}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardText}>ID Cliente: {item.idCliente}</Text>
          <Text style={styles.cardText}>Clave Producto: {item.claveProd}</Text>
          <Text style={styles.cardText}>
            Actualizado: {item.fechaAct?.toLocaleDateString() || 'N/A'}
          </Text>
          {item.syncedAr && (
            <Text style={styles.cardText}>
              Sync (MX): {item.syncedAr.toLocaleString('es-MX')}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderInventario = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Producto {item.claveProd}</Text>
          <Text style={styles.cardSubtitle}>Sucursal {item.sucursal}</Text>
        </View>
        <TouchableOpacity
          onPress={() => handleDelete(item.id, 'inventario')}
          style={styles.deleteButton}
        >
          <Icon name="delete" type="material" color={COLORS.error} size={24} />
        </TouchableOpacity>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardText}>ID: {item.id}</Text>
        <Text style={styles.cardPrice}>Saldo: {item.saldo}</Text>
        <Text style={styles.cardText}>
          Fecha Arrastre: {item.fechaArrastre?.toLocaleString() || 'N/A'}
        </Text>
        {item.syncedAr && (
          <Text style={styles.cardText}>
            Sync (MX): {item.syncedAr.toLocaleString('es-MX')}
          </Text>
        )}
      </View>
    </View>
  );

  const renderCartera = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => console.log('ventas', item)}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.nombreCliente}</Text>
            <Text style={styles.cardPrice}>${item.saldo?.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDelete(item.id, 'cartera')}
            style={styles.deleteButton}
          >
            <Icon
              name="delete"
              type="material"
              color={COLORS.error}
              size={24}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardText}>ID Cliente: {item.idCliente}</Text>
          <Text style={styles.cardText}>Sucursal: {item.sucursal}</Text>
          <Text style={styles.cardText}>No. Venta: {item.noVenta}</Text>
          <Text style={styles.cardText}>
            Fecha: {item.fecha?.toLocaleDateString() || 'N/A'}
          </Text>
          {item.syncedAr && (
            <Text style={styles.cardText}>
              Sync (MX): {item.syncedAr.toLocaleString('es-MX')}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderUsuario = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.nombre}</Text>
          <Text style={styles.cardSubtitle}>{item.claveEmpleado}</Text>
        </View>
        <TouchableOpacity
          onPress={() => handleDelete(item.id, 'usuarios')}
          style={styles.deleteButton}
        >
          <Icon name="delete" type="material" color={COLORS.error} size={24} />
        </TouchableOpacity>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardText}>Perfil: {item.descripcionPerfil}</Text>
        <Text style={styles.cardText}>Puesto: {item.descripcionPuesto}</Text>
        <Text style={styles.cardText}>
          Sucursal Origen: {item.sucursalOrigen}
        </Text>
        {item.syncedAr && (
          <Text style={styles.cardText}>
            Sync (MX): {item.syncedAr.toLocaleString('es-MX')}
          </Text>
        )}
      </View>
    </View>
  );

  const renderSyncLog = ({ item }: { item: any }) => {
    const duracionSeg = item.duracionMs
      ? (item.duracionMs / 1000).toFixed(1)
      : 'N/A';
    const statusColor = item.exitoso ? COLORS.success : COLORS.error;
    const statusIcon = item.exitoso ? 'check-circle' : 'error';

    return (
      <View
        style={[
          styles.card,
          { borderLeftWidth: 4, borderLeftColor: statusColor },
        ]}
      >
        <View style={styles.cardHeader}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              flex: 1,
            }}
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
            <Text style={styles.cardSubtitle}>
              {item.tipo === 'manual' ? '👤 Manual' : '🤖 Auto'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDelete(item.id, 'syncLogs')}
            style={styles.deleteButton}
          >
            <Icon
              name="delete"
              type="material"
              color={COLORS.error}
              size={24}
            />
          </TouchableOpacity>
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
    );
  };

  const renderBitacora = ({ item }: { item: any }) => {
    const duracionSeg = item.duracionMs
      ? (item.duracionMs / 1000).toFixed(1)
      : '0';
    const totalRegistros =
      (item.registrosLeidos || 0) +
      (item.registrosGuardados || 0) +
      (item.registrosActualizados || 0);

    return (
      <View style={[styles.card, !item.exitoso && styles.cardError]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.tabla}</Text>
            <Text style={styles.cardSubtitle}>
              {item.fechaInicio
                ? new Date(item.fechaInicio).toLocaleString()
                : 'N/A'}
            </Text>
          </View>
          <View
            style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 8 }}
          >
            <View style={{ alignItems: 'center' }}>
              <Icon
                name={item.exitoso ? 'check-circle' : 'error'}
                type="material"
                size={24}
                color={item.exitoso ? COLORS.success : COLORS.error}
              />
              <Text
                style={[
                  styles.cardPrice,
                  { color: item.exitoso ? COLORS.success : COLORS.error },
                ]}
              >
                {item.exitoso ? 'Éxito' : 'Error'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleDelete(item.id, 'bitacora')}
              style={styles.deleteButton}
            >
              <Icon
                name="delete"
                type="material"
                color={COLORS.error}
                size={24}
              />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardText}>⏱️ Duración: {duracionSeg}s</Text>
          <Text style={styles.cardText}>
            📊 Leídos: {item.registrosLeidos || 0} | 💾 Guardados:{' '}
            {item.registrosGuardados || 0} | 🔄 Actualizados:{' '}
            {item.registrosActualizados || 0}
          </Text>
          <Text style={styles.cardText}>
            📈 Total procesados: {totalRegistros}
          </Text>
          {!item.exitoso && item.razon && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>❌ {item.razon}</Text>
            </View>
          )}
          {item.endpoint && (
            <Text
              style={[styles.cardText, { fontSize: 11, color: COLORS.muted }]}
            >
              🌐 {item.endpoint}
            </Text>
          )}
          {item.detalles && (
            <Text
              style={[styles.cardText, { fontSize: 10, color: COLORS.muted }]}
            >
              📋 {JSON.stringify(item.detalles)}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    switch (selectedTab) {
      case 'syncLogs':
        return renderSyncLog({ item });
      case 'bitacora':
        return renderBitacora({ item });
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
          Mostrando {filteredData.length} de {getCount()} registros
          {searchQuery &&
            ` (${filteredData.length < data.length ? 'filtrados' : 'todos'})`}
        </Text>
        {getCount() > 0 && (
          <TouchableOpacity
            style={styles.deleteAllButton}
            onPress={handleDeleteAll}
          >
            <Icon name="delete-sweep" type="material" color="#fff" size={20} />
            <Text style={styles.deleteAllButtonText}>Eliminar Todo</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Icon
            name="search"
            type="material"
            color={COLORS.textSecondary}
            size={20}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por ID, descripción, nombre..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Icon
                name="close"
                type="material"
                color={COLORS.textSecondary}
                size={20}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Pagination Controls - Solo mostrar cuando no hay búsqueda */}
      {!searchQuery && (
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
      )}

      {/* Data List */}
      <FlatList
        data={filteredData}
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
              <Text style={styles.emptyText}>
                {searchQuery
                  ? 'No se encontraron resultados'
                  : 'No hay datos sincronizados'}
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery
                  ? 'Intenta con otra búsqueda'
                  : 'Inicia sesión nuevamente para sincronizar'}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  deleteAllButton: {
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...SHADOWS.small,
  },
  deleteAllButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
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
  cardError: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
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
  deleteButton: {
    padding: SPACING.s,
    borderRadius: BORDER_RADIUS.m,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    marginLeft: SPACING.s,
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
  searchContainer: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.m,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.s,
  },
  searchIcon: {
    marginRight: SPACING.s,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    paddingVertical: SPACING.s,
  },
  clearButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.s,
  },
});
