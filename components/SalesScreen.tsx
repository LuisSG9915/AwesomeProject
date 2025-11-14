import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import TicketPrinter from '../services/TicketPrinter';
import BluetoothPrinterService from '../services/BluetoothPrinterService';
import FullSyncService from '../services/FullSyncService';
import AuthService, { Usuario } from '../services/AuthService';
import { APP_NAME, COLORS } from '../theme/theme';

type Cliente = {
  id: number;
  nombre: string;
  credito?: boolean;
  idGrupo?: number;
};

type Producto = {
  id: number;
  claveProd: string;
  descripcion: string;
  precio: number;
};

type CartItem = Producto & { cantidad: number };

export default function SalesScreen() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
  const [filteredProductos, setFilteredProductos] = useState<Producto[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchProductoQuery, setSearchProductoQuery] = useState('');

  const [clienteModalOpen, setClienteModalOpen] = useState(false);
  const [productoModalOpen, setProductoModalOpen] = useState(false);

  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [metodoPago, setMetodoPago] = useState<
    'efectivo' | 'transferencia' | 'credito' | null
  >(null);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [printerName, setPrinterName] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<Usuario | null>(null);
  const [currentSucursal, setCurrentSucursal] = useState<number>(1);

  useEffect(() => {
    const init = async () => {
      const status = BluetoothPrinterService.getStatus();
      setPrinterConnected(status.connected);
      setPrinterName(status.printer?.name || '');

      // Cargar sesión para obtener sucursal y vendedor
      const user = await AuthService.restoreSession();
      if (user) {
        setCurrentUser(user);
        const sucursal =
          (user.sucursal_origen as number | null | undefined) ??
          (user.sucursal as number | null | undefined) ??
          1;
        setCurrentSucursal(sucursal);
      }

      // Cargar datos de Realm
      await loadDataFromRealm();
    };

    init();
  }, []);

  const loadDataFromRealm = async () => {
    try {
      await FullSyncService.initialize();

      // Cargar clientes
      const clientesData = FullSyncService.getClientesFull(10000);
      const clientesFormateados = clientesData.map((c: any) => ({
        id: c.id,
        nombre: c.nombre || 'Sin nombre',
        credito: c.credito || false,
        idGrupo: c.idGrupo,
      }));
      setClientes(clientesFormateados);
      setFilteredClientes(clientesFormateados);

      // Cargar productos con precios
      const productosData = FullSyncService.getProductos(1000);
      const preciosData = FullSyncService.getPrecios(5000);

      // Crear mapa de precios por claveProd
      const preciosMap = new Map();
      preciosData.forEach((p: any) => {
        if (!preciosMap.has(p.claveProd) || p.idCliente === 0) {
          preciosMap.set(p.claveProd, p.precio || 0);
        }
      });

      const productosFormateados = productosData.map((p: any) => ({
        id: p.id,
        claveProd: p.claveProd || '',
        descripcion: p.descripcion || 'Sin descripción',
        precio: preciosMap.get(parseInt(p.claveProd)) || 0,
      }));
      setProductos(productosFormateados);
      setFilteredProductos(productosFormateados);
    } catch (error) {
      console.error('Error al cargar datos de Realm:', error);
      Alert.alert(
        'Error',
        'No se pudieron cargar los datos. Sincroniza primero.',
      );
    }
  };

  const handleSearchCliente = useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (!query.trim()) {
        setFilteredClientes(clientes);
        return;
      }

      const lowerQuery = query.toLowerCase();
      const filtered = clientes.filter(
        c =>
          c.nombre.toLowerCase().includes(lowerQuery) ||
          c.id.toString().includes(query),
      );

      setFilteredClientes(filtered);
    },
    [clientes],
  );

  const handleSearchProducto = useCallback(
    (query: string) => {
      setSearchProductoQuery(query);

      if (!query.trim()) {
        setFilteredProductos(productos);
        return;
      }

      const lowerQuery = query.toLowerCase();
      const filtered = productos.filter(
        p =>
          p.descripcion.toLowerCase().includes(lowerQuery) ||
          p.claveProd.includes(query) ||
          p.id.toString().includes(query),
      );

      setFilteredProductos(filtered);
    },
    [productos],
  );

  const total = useMemo(
    () => cart.reduce((acc, it) => acc + it.precio * it.cantidad, 0),
    [cart],
  );

  const addToCart = (p: Producto) => {
    setCart(prev => {
      const idx = prev.findIndex(ci => ci.id === p.id);
      if (idx >= 0) {
        const cp = [...prev];
        cp[idx] = { ...cp[idx], cantidad: cp[idx].cantidad + 1 };
        return cp;
      }
      return [...prev, { ...p, cantidad: 1 }];
    });
    setProductoModalOpen(false);
  };

  const updateQuantity = (id: number, cantidad: number) => {
    if (cantidad <= 0) return;
    setCart(prev => prev.map(ci => (ci.id === id ? { ...ci, cantidad } : ci)));
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(ci => ci.id !== id));
  };

  const buildMovilSaleId = (sucursal: number): number => {
    const suffix = sucursal.toString().padStart(3, '0');
    const base = Date.now().toString();
    return Number(`${base}${suffix}`);
  };

  useEffect(() => {
    if (selectedClient) {
      const preciosCliente = FullSyncService.getPreciosByCliente(
        selectedClient.id,
      );
      // Crear mapa de precios por claveProd
      const preciosMap = new Map();
      preciosCliente.forEach((p: any) => {
        if (!preciosMap.has(p.claveProd) || p.idCliente === 0) {
          preciosMap.set(p.claveProd, p.precio || 0);
        }
      });

      const productosFormateados = preciosCliente.map((p: any) => ({
        id: p.id,
        claveProd: p.claveProd || '',
        descripcion: p.descripcion || 'Sin descripción',
        precio: preciosMap.get(parseInt(p.claveProd)) || 0,
      }));
      setProductos(productosFormateados);
      setFilteredProductos(productosFormateados);
    }
  }, [selectedClient]);

  const processSale = async () => {
    const client = selectedClient;
    console.log('[Sales] processSale called', {
      client,
      cartLength: cart.length,
      metodoPago,
      currentSucursal,
      total,
    });
    if (!client) {
      Alert.alert('Error', 'Selecciona un cliente');
      return;
    }
    if (!cart.length) {
      Alert.alert('Error', 'Agrega productos al carrito');
      return;
    }
    if (!metodoPago) {
      Alert.alert('Error', 'Selecciona un método de pago');
      return;
    }

    try {
      const sucursal = currentSucursal || 1;
      const saleIdMovil = buildMovilSaleId(sucursal);
      const inventarioBaseId = buildMovilSaleId(sucursal);
      const tipoPagoCode =
        metodoPago === 'efectivo' ? 1 : metodoPago === 'credito' ? 2 : 3; // transferencia
      const descripcionMedioPago =
        metodoPago === 'efectivo'
          ? 'Efectivo'
          : metodoPago === 'credito'
          ? 'Credito'
          : 'Transferencia';
      const vendedor =
        (currentUser?.claveEmpleado as string | undefined) ||
        (currentUser?.nombre as string | undefined) ||
        '';
      const now = new Date();

      console.log('[Sales] Built sale metadata', {
        sucursal,
        saleIdMovil,
        inventarioBaseId,
        tipoPagoCode,
        descripcionMedioPago,
        vendedor,
        now,
      });

      // Ticket con formato detallado
      console.log('[Sales] About to print sale ticket', {
        clientName: client.nombre,
        metodoPago,
        itemsCount: cart.length,
        total,
        saleIdMovil,
      });
      await TicketPrinter.printSaleTicket({
        clientName: client.nombre,
        paymentMethod: metodoPago,
        items: cart.map(item => ({
          description: item.descripcion,
          quantity: item.cantidad,
          price: item.precio,
          total: item.precio * item.cantidad,
        })),
        total: total,
        businessName: APP_NAME,
        date: now,
        ticketNumber: String(saleIdMovil),
        sellerName: vendedor,
        branch: sucursal,
      });
      console.log('[Sales] Ticket printed OK', { saleIdMovil });

      // Registrar venta en Realm (una fila por producto)
      console.log('[Sales] Creating local ventas in Realm', {
        rows: cart.length,
        saleIdMovil,
      });
      await FullSyncService.createLocalVentas(
        cart.map((item, index) => ({
          id: saleIdMovil + index,
          sucursal,
          noVenta: saleIdMovil,
          claveProd: parseInt(item.claveProd || '0', 10) || null,
          nombreProducto: item.descripcion,
          cantProducto: item.cantidad,
          precio: item.precio,
          importe: item.precio * item.cantidad,
          cveCliente: client.id,
          nombreCliente: client.nombre,
          fecha: now,
          tipoPago: tipoPagoCode,
          descripcionMedioPago,
          vendedor,
          folioFactura: false,
          facturacionMovil: false,
        })),
      );
      console.log('[Sales] Local ventas created');

      // Registrar movimiento de inventario (una fila por producto, saldo negativo)
      console.log('[Sales] Creating local inventario movements', {
        rows: cart.length,
        inventarioBaseId,
      });
      await FullSyncService.createLocalInventarioMovements(
        cart.map((item, index) => ({
          id: inventarioBaseId + index,
          sucursal,
          // Usamos la clave de producto numérica como clave de inventario
          claveProd: parseInt(item.claveProd || '0', 10) || null,
          saldo: -Math.abs(item.cantidad),
          fechaArrastre: now,
        })),
      );
      console.log('[Sales] Local inventario movements created');

      // Actualizar estado de impresora
      const status = BluetoothPrinterService.getStatus();
      setPrinterConnected(status.connected);

      if (status.connected) {
        Alert.alert(
          '🖨️ Venta Procesada',
          `Cliente: ${client.nombre}\nTotal: $${total.toFixed(
            2,
          )}\nPago: ${metodoPago}\n\nTicket enviado a: ${status.printer?.name}`,
        );
      } else {
        Alert.alert(
          '✅ Venta Procesada',
          `Cliente: ${client.nombre}\nTotal: $${total.toFixed(
            2,
          )}\nPago: ${metodoPago}`,
        );
      }

      // Limpiar formulario
      setCart([]);
      setMetodoPago(null);
      setSelectedClient(null);
    } catch (error) {
      console.error('[Sales] Error in processSale', error);
      Alert.alert('Error', 'No se pudo procesar la venta');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header con estado de impresora */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Punto de Venta</Text>
          {printerConnected && (
            <View style={styles.printerBadge}>
              <Text style={styles.printerBadgeText}>
                🖨️ {printerName || 'OK'}
              </Text>
            </View>
          )}
        </View>

        {!printerConnected && (
          <View style={styles.warningCard}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningText}>
              Sin impresora. Los tickets se compartirán o deberás configurar
              una.
            </Text>
          </View>
        )}

        {/* Cliente */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Cliente</Text>
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={() => setClienteModalOpen(true)}
            >
              <Text style={styles.smallBtnText}>Seleccionar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.valueText}>
            {selectedClient ? selectedClient.nombre : 'Sin seleccionar'}
          </Text>
        </View>

        {/* Productos */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Productos</Text>
            <TouchableOpacity
              style={[
                styles.smallBtn,
                !selectedClient && styles.smallBtnDisabled,
              ]}
              onPress={() => selectedClient && setProductoModalOpen(true)}
              disabled={!selectedClient}
            >
              <Text style={styles.smallBtnText}>Agregar</Text>
            </TouchableOpacity>
          </View>

          {cart.length === 0 ? (
            <Text style={styles.muted}>No hay productos</Text>
          ) : (
            <View style={styles.cartList}>
              {cart.map(item => (
                <View key={item.id} style={styles.cartRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartTitle}>{item.descripcion}</Text>
                    <Text style={styles.muted}>${item.precio.toFixed(2)}</Text>
                  </View>
                  <View style={styles.qtyBox}>
                    <TextInput
                      style={styles.qtyInput}
                      keyboardType="number-pad"
                      value={String(item.cantidad)}
                      onChangeText={t => {
                        const n = parseInt(t || '0', 10);
                        if (Number.isFinite(n) && n > 0)
                          updateQuantity(item.id, n);
                      }}
                    />
                  </View>
                  <Text style={styles.lineTotal}>
                    ${(item.precio * item.cantidad).toFixed(2)}
                  </Text>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeFromCart(item.id)}
                  >
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Pago */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pago</Text>
          <View style={styles.payRow}>
            <PayChip
              label="Efectivo"
              selected={metodoPago === 'efectivo'}
              onPress={() => setMetodoPago('efectivo')}
            />
            <PayChip
              label="Transferencia"
              selected={metodoPago === 'transferencia'}
              onPress={() => setMetodoPago('transferencia')}
            />
            <PayChip
              label="Crédito"
              selected={metodoPago === 'credito'}
              onPress={() => setMetodoPago('credito')}
              disabled={selectedClient ? !selectedClient.credito : true}
            />
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalText}>Total</Text>
            <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (!selectedClient || !cart.length || !metodoPago) &&
                styles.primaryBtnDisabled,
            ]}
            onPress={processSale}
            disabled={!selectedClient || !cart.length || !metodoPago}
          >
            <Text style={styles.primaryBtnText}>Procesar Venta</Text>
          </TouchableOpacity>
        </View>

        {/* Modal Clientes */}
        <Modal visible={clienteModalOpen} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Seleccionar Cliente</Text>

              {/* Buscador */}
              <Text style={styles.searchLabel}>Buscar cliente</Text>
              <View style={styles.searchContainer}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar por nombre o ID..."
                  placeholderTextColor={COLORS.muted}
                  value={searchQuery}
                  onChangeText={handleSearchCliente}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => handleSearchCliente('')}
                    style={styles.clearButton}
                  >
                    <Text style={styles.clearButtonText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Contador de resultados */}
              <Text style={styles.resultCount}>
                {filteredClientes.length} cliente
                {filteredClientes.length !== 1 ? 's' : ''}{' '}
                {filteredClientes.length === 1 ? 'encontrado' : 'encontrados'}
              </Text>

              <FlatList
                data={filteredClientes}
                keyExtractor={i => String(i.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.listItem}
                    onPress={() => {
                      setSelectedClient(item);
                      setCart([]);
                      setMetodoPago(null);
                      setClienteModalOpen(false);
                      setSearchQuery('');
                      setFilteredClientes(clientes);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listTitle}>{item.nombre}</Text>
                      <Text style={styles.listSubtitle}>ID: {item.id}</Text>
                    </View>
                    {item.credito ? (
                      <Text style={styles.badge}>Crédito</Text>
                    ) : null}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptySearch}>
                    <Text style={styles.emptySearchText}>
                      No se encontraron clientes
                    </Text>
                  </View>
                }
              />
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => {
                  setClienteModalOpen(false);
                  setSearchQuery('');
                  setFilteredClientes(clientes);
                }}
              >
                <Text style={styles.secondaryBtnText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Modal Productos */}
        <Modal visible={productoModalOpen} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Seleccionar Producto</Text>

              {/* Buscador */}
              <Text style={styles.searchLabel}>Buscar producto</Text>
              <View style={styles.searchContainer}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar por descripción o clave..."
                  placeholderTextColor={COLORS.muted}
                  value={searchProductoQuery}
                  onChangeText={handleSearchProducto}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchProductoQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => handleSearchProducto('')}
                    style={styles.clearButton}
                  >
                    <Text style={styles.clearButtonText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Contador de resultados */}
              <Text style={styles.resultCount}>
                {filteredProductos.length} producto
                {filteredProductos.length !== 1 ? 's' : ''}{' '}
                {filteredProductos.length === 1 ? 'encontrado' : 'encontrados'}
              </Text>

              <FlatList
                data={filteredProductos}
                keyExtractor={i => String(i.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.listItem}
                    onPress={() => {
                      addToCart(item);
                      setSearchProductoQuery('');
                      setFilteredProductos(productos);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listTitle}>{item.descripcion}</Text>
                      <Text style={styles.listSubtitle}>
                        Clave: {item.claveProd}
                      </Text>
                    </View>
                    <Text style={styles.productPrice}>
                      ${item.precio.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptySearch}>
                    <Text style={styles.emptySearchText}>
                      No se encontraron productos
                    </Text>
                  </View>
                }
              />
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => {
                  setProductoModalOpen(false);
                  setSearchProductoQuery('');
                  setFilteredProductos(productos);
                }}
              >
                <Text style={styles.secondaryBtnText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
}

function PayChip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.chip,
        selected && styles.chipSelected,
        disabled && styles.chipDisabled,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 32 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  printerBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  printerBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  warningCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  warningIcon: { fontSize: 20 },
  warningText: {
    flex: 1,
    color: COLORS.warning,
    fontSize: 13,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  valueText: { marginTop: 8, color: COLORS.textPrimary },
  smallBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  smallBtnDisabled: { opacity: 0.5 },
  smallBtnText: { color: '#fff', fontWeight: '600' },
  muted: { color: COLORS.textSecondary },
  cartList: { marginTop: 8 },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cartTitle: { fontWeight: '600', color: COLORS.textPrimary },
  qtyBox: { width: 56, marginHorizontal: 8 },
  qtyInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 4,
    textAlign: 'center',
  },
  lineTotal: { width: 80, textAlign: 'right', fontWeight: '600' },
  removeBtn: { padding: 8, marginLeft: 8 },
  removeBtnText: { color: COLORS.error, fontSize: 16 },
  payRow: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipDisabled: { opacity: 0.4 },
  chipText: { color: COLORS.textPrimary },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  totalText: { fontSize: 16, fontWeight: '600', color: COLORS.textSecondary },
  totalValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
  primaryBtn: {
    backgroundColor: COLORS.success,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: COLORS.textPrimary,
  },
  listItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  listTitle: { fontWeight: '600', color: COLORS.textPrimary },
  listSubtitle: { color: COLORS.textSecondary },
  badge: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
    borderWidth: 1,
    color: COLORS.primaryDark,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '600',
    alignSelf: 'flex-start',
  },
  secondaryBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryBtnText: { color: COLORS.textPrimary, fontWeight: '700' },
  note: {
    marginTop: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontSize: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
    color: COLORS.muted,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    paddingVertical: 4,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  clearButtonText: {
    fontSize: 18,
    color: COLORS.muted,
  },
  searchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  resultCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 8,
    fontWeight: '500',
  },
  emptySearch: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: 16,
    color: COLORS.muted,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginLeft: 12,
  },
});
