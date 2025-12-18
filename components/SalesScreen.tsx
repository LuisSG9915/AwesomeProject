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
  ActivityIndicator,
} from 'react-native';
import TicketPrinter from '../services/TicketPrinter';
import BluetoothPrinterService from '../services/BluetoothPrinterService';
import FullSyncService from '../services/FullSyncService';
import AuthService, { Usuario } from '../services/AuthService';
import {
  APP_NAME,
  COLORS,
  SPACING,
  SHADOWS,
  BORDER_RADIUS,
  TYPOGRAPHY,
} from '../theme/theme';

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
  existencia: number;
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
  const [initializingPrinter, setInitializingPrinter] = useState(true);
  const [processingSale, setProcessingSale] = useState(false);
  const [saleProcessLocked, setSaleProcessLocked] = useState(false);
  const [quantityInputs, setQuantityInputs] = useState<{
    [id: number]: string;
  }>({});

  const LOCAL_SALE_ID_THRESHOLD = 1700000000000;

  useEffect(() => {
    const init = async () => {
      setInitializingPrinter(true);

      try {
        let status = BluetoothPrinterService.getStatus();
        if (!status.connected) {
          await BluetoothPrinterService.connectToSavedPrinter();
        }

        status = BluetoothPrinterService.getStatus();
        setPrinterConnected(status.connected);
        setPrinterName(status.printer?.name || '');

        const user = await AuthService.restoreSession();
        if (user) {
          setCurrentUser(user);
          const sucursal =
            (user.sucursal_origen as number | null | undefined) ??
            (user.sucursal as number | null | undefined) ??
            1;
          setCurrentSucursal(sucursal);
        }

        await loadDataFromRealm();
      } finally {
        setInitializingPrinter(false);
      }
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

      // Cargar productos con precios e inventario
      const productosData = FullSyncService.getProductos(1000);
      const preciosData = FullSyncService.getPrecios(10000);
      const inventarioData = FullSyncService.getInventario();

      // Crear mapa de precios por claveProd
      const preciosMap = new Map();
      preciosData.forEach((p: any) => {
        if (!preciosMap.has(p.claveProd) || p.idCliente === 0) {
          preciosMap.set(p.claveProd, p.precio || 0);
        }
      });

      // Crear mapa de inventario por claveProd para la sucursal actual
      const inventarioMap = new Map<number, number>();
      inventarioData
        .filter((i: any) => i.sucursal == currentSucursal)
        .forEach((i: any) => {
          const clave = i.claveProd;
          if (clave === null || clave === undefined) return;
          const saldoActual = inventarioMap.get(clave) || 0;
          inventarioMap.set(clave, saldoActual + (i.saldo || 0));
        });

      const productosFormateados = productosData
        .map((p: any) => {
          const claveProdNum = parseInt(p.claveProd);
          const existencia = inventarioMap.get(claveProdNum) || 0;

          return {
            id: p.id,
            claveProd: p.claveProd || '',
            descripcion: p.descripcion || 'Sin descripción',
            precio: preciosMap.get(claveProdNum) || 0,
            existencia,
          };
        })
        .filter((p: Producto) => p.existencia > 0); // Solo productos con existencia

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
        const nuevaCantidad = prev[idx].cantidad + 1;
        const cp = [...prev];
        cp[idx] = { ...cp[idx], cantidad: nuevaCantidad };
        return cp;
      }
      return [...prev, { ...p, cantidad: 1 }];
    });
    setProductoModalOpen(false);
  };

  const updateQuantity = (id: number, cantidad: number) => {
    if (cantidad <= 0) return;

    setCart(prev => {
      return prev.map(ci => {
        if (ci.id === id) {
          return { ...ci, cantidad };
        }
        return ci;
      });
    });
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
      const inventarioData = FullSyncService.getInventario();

      // Crear mapa de precios por claveProd
      const preciosMap = new Map();
      preciosCliente.forEach((p: any) => {
        if (!preciosMap.has(p.claveProd) || p.idCliente === 0) {
          preciosMap.set(p.claveProd, p.precio || 0);
        }
      });

      // Crear mapa de inventario por claveProd para la sucursal actual
      const inventarioMap = new Map<number, number>();
      inventarioData
        .filter((i: any) => i.sucursal == currentSucursal)
        .forEach((i: any) => {
          const clave = i.claveProd;
          if (clave === null || clave === undefined) return;
          const saldoActual = inventarioMap.get(clave) || 0;
          inventarioMap.set(clave, saldoActual + (i.saldo || 0));
        });

      const productosFormateados = preciosCliente
        .map((p: any) => {
          const claveProdNum = parseInt(p.claveProd);
          const existencia = inventarioMap.get(claveProdNum) || 0;

          return {
            id: p.id,
            claveProd: p.claveProd || '',
            descripcion: p.descripcion || 'Sin descripción',
            precio: preciosMap.get(claveProdNum) || 0,
            existencia,
          };
        })
        .filter((p: Producto) => p.precio > 0); // Solo productos con precio asignado

      setProductos(productosFormateados);
      setFilteredProductos(productosFormateados);
    }
  }, [selectedClient, currentSucursal]);

  const syncPendingSalesInBackground = useCallback(async () => {
    try {
      const idUsuarioRaw =
        (currentUser as any)?.idUsuario ?? (currentUser as any)?.id ?? 1;
      const idUsuario = Number.isFinite(Number(idUsuarioRaw))
        ? Number(idUsuarioRaw)
        : 1;
      const sucursal = currentSucursal || 0;

      console.log(
        '[Sales] Background sync: Iniciando sincronización de ventas pendientes',
      );
      const result = await FullSyncService.sendPendingVentasToServer(
        sucursal,
        idUsuario,
      );

      if (result.success) {
        console.log(
          '[Sales] Background sync: Ventas enviadas exitosamente',
          result.sent,
        );
      } else {
        console.error(
          '[Sales] Background sync: Error al enviar ventas',
          result.error,
        );
      }

      // Sincronización incremental después del arrastre
      console.log(
        '[Sales] Background sync: Ejecutando sincronización incremental...',
      );
      await FullSyncService.syncIncremental();
      console.log(
        '[Sales] Background sync: Sincronización incremental completada',
      );
    } catch (error) {
      console.error('[Sales] Background sync: Error en sincronización', error);
    }
  }, [currentUser, currentSucursal]);

  const processSale = async () => {
    const client = selectedClient;

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

    // Validar existencias actuales antes de procesar
    // Obtener inventario actualizado en tiempo real
    const inventarioData = FullSyncService.getInventario();
    const inventarioMap = new Map<number, number>();
    inventarioData
      .filter((i: any) => i.sucursal == currentSucursal)
      .forEach((i: any) => {
        const clave = i.claveProd;
        if (clave === null || clave === undefined) return;
        const saldoActual = inventarioMap.get(clave) || 0;
        inventarioMap.set(clave, saldoActual + (i.saldo || 0));
      });

    const productosInsuficientes: string[] = [];
    cart.forEach(item => {
      const claveProdNum = parseInt(item.claveProd || '0');
      const existenciaActual = inventarioMap.get(claveProdNum) || 0;

      if (item.cantidad > existenciaActual) {
        productosInsuficientes.push(
          `${item.descripcion} (Requiere: ${item.cantidad}, Disponible: ${existenciaActual})`,
        );
      }
    });

    if (productosInsuficientes.length > 0) {
      Alert.alert(
        'Existencias Insuficientes',
        `No se puede procesar la venta. Los siguientes productos no tienen existencias suficientes:\n\n${productosInsuficientes.join(
          '\n',
        )}`,
        [{ text: 'Entendido', style: 'default' }],
      );
      return;
    }

    // Protección crítica contra múltiples clics
    if (saleProcessLocked) {
      console.log('[Sales] Venta ya en proceso, ignorando clic adicional');
      return;
    }

    setSaleProcessLocked(true);
    setProcessingSale(true);
    try {
      const sucursal = currentSucursal || 0;
      const saleIdMovil = buildMovilSaleId(sucursal);
      const inventarioBaseId = buildMovilSaleId(sucursal);
      const tipoPagoCode =
        metodoPago === 'efectivo' ? 1 : metodoPago === 'credito' ? 3 : 2; // transferencia
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

      // Formatear fecha como string en horario local mexicano
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const ms = String(now.getMilliseconds()).padStart(3, '0');
      const fechaMX = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}.${ms}`;

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

      const localVentasPayload = cart.map((item, index) => ({
        id: saleIdMovil + index,
        idMovil: saleIdMovil,
        sucursal,
        noVenta: 0,
        claveProd: parseInt(item.claveProd || '0', 10) || null,
        nombreProducto: item.descripcion,
        cantProducto: item.cantidad,
        precio: item.precio,
        importe: item.precio * item.cantidad,
        cveCliente: client.id,
        nombreCliente: client.nombre,
        fecha: fechaMX,
        tipoPago: tipoPagoCode,
        descripcionMedioPago,
        vendedor,
        folioFactura: false,
        facturacionMovil: false,
      }));

      await FullSyncService.createLocalVentas(localVentasPayload);
      console.log('[Sales] Local ventas created');

      // Actualizar inventario restando las cantidades vendidas
      console.log('[Sales] Updating inventory after sale', {
        rows: cart.length,
      });
      await FullSyncService.updateInventarioAfterSale(
        cart.map(item => ({
          sucursal,
          claveProd: parseInt(item.claveProd || '0', 10),
          cantidad: item.cantidad,
        })),
      );
      console.log('[Sales] Inventory updated successfully');

      // Intentar arrastre con timeout estricto de 3 segundos
      try {
        const idUsuarioRaw =
          (currentUser as any)?.idUsuario ?? (currentUser as any)?.id ?? 1;
        const idUsuario = Number.isFinite(Number(idUsuarioRaw))
          ? Number(idUsuarioRaw)
          : 1;

        console.log('[Sales] Intentando arrastre con timeout de 3 segundos...');

        const arrastrePromise = FullSyncService.sendPendingVentasToServer(
          sucursal,
          idUsuario,
        );

        const timeoutPromise = new Promise<{ success: false; error: string }>(
          resolve => {
            setTimeout(() => {
              resolve({
                success: false,
                error: 'Timeout de 3 segundos excedido',
              });
            }, 3000);
          },
        );

        const result = await Promise.race([arrastrePromise, timeoutPromise]);

        if (result.success) {
          console.log('[Sales] Arrastre completado exitosamente', result.sent);
        } else {
          console.warn('[Sales] Arrastre omitido o falló:', result.error);
          // Programar sincronización en background
          setTimeout(() => {
            console.log('[Sales] Ejecutando sincronización en background...');
            syncPendingSalesInBackground();
          }, 500);
        }
      } catch (arrastreError) {
        console.error('[Sales] Error en arrastre', arrastreError);
        // Programar sincronización en background
        setTimeout(() => {
          console.log(
            '[Sales] Ejecutando sincronización en background tras error...',
          );
          syncPendingSalesInBackground();
        }, 500);
      }

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
    } finally {
      setProcessingSale(false);
      setSaleProcessLocked(false);
    }
  };

  if (initializingPrinter) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>
              Preparando conexión con la impresora...
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

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
                      value={quantityInputs[item.id] ?? String(item.cantidad)}
                      onChangeText={t => {
                        // Permitir cualquier valor mientras escribe
                        if (!/^\d*$/.test(t)) {
                          return;
                        }
                        setQuantityInputs(prev => ({ ...prev, [item.id]: t }));
                        if (t === '') {
                          // Campo vacío, no actualizar aún
                          return;
                        }
                        const n = parseInt(t, 10);
                        if (Number.isFinite(n) && n >= 0) {
                          updateQuantity(item.id, n);
                        }
                      }}
                      onBlur={() => {
                        // Al salir del campo, si está vacío o es 0, poner 1
                        const currentText = quantityInputs[item.id];
                        if (!currentText || currentText === '0') {
                          updateQuantity(item.id, 1);
                        } else {
                          const n = parseInt(currentText, 10);
                          if (Number.isFinite(n) && n > 0) {
                            updateQuantity(item.id, n);
                          }
                        }
                        setQuantityInputs(prev => {
                          const next = { ...prev };
                          delete next[item.id];
                          return next;
                        });
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
              (!selectedClient ||
                !cart.length ||
                !metodoPago ||
                processingSale) &&
                styles.primaryBtnDisabled,
            ]}
            onPress={processSale}
            disabled={
              !selectedClient || !cart.length || !metodoPago || processingSale
            }
          >
            {processingSale ? (
              <View style={styles.loadingBtnRow}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.primaryBtnText}> Procesando venta...</Text>
              </View>
            ) : (
              <Text style={styles.primaryBtnText}>Procesar Venta</Text>
            )}
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
                      // Auto-abrir modal de productos después de seleccionar cliente
                      setTimeout(() => setProductoModalOpen(true), 300);
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
                      <Text style={styles.listSubtitle}>
                        Existencia: {item.existencia}
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
  content: { padding: SPACING.m, paddingBottom: SPACING.xxl },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.m,
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
    paddingHorizontal: SPACING.xs,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
  },
  printerBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.l,
  },
  printerBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  warningCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    marginBottom: SPACING.m,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    ...SHADOWS.small,
  },
  warningIcon: { fontSize: 20 },
  warningText: {
    flex: 1,
    color: COLORS.warning,
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.l,
    padding: SPACING.m,
    marginBottom: SPACING.m,
    ...SHADOWS.small,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.s,
  },
  cardTitle: { ...TYPOGRAPHY.h3, fontSize: 18 },
  valueText: {
    marginTop: SPACING.s,
    ...TYPOGRAPHY.body,
    fontSize: 16,
  },
  smallBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.m,
  },
  smallBtnDisabled: { opacity: 0.5 },
  smallBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  muted: { color: COLORS.muted, fontStyle: 'italic' },
  cartList: { marginTop: SPACING.s },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cartTitle: { fontWeight: '600', color: COLORS.textPrimary, fontSize: 14 },
  qtyBox: { width: 60, marginHorizontal: SPACING.s },
  qtyInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.s,
    paddingVertical: 4,
    textAlign: 'center',
    color: COLORS.textPrimary,
  },
  lineTotal: {
    width: 80,
    textAlign: 'right',
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  removeBtn: { padding: SPACING.s, marginLeft: SPACING.s },
  removeBtnText: { color: COLORS.error, fontSize: 18, fontWeight: 'bold' },
  payRow: { flexDirection: 'row', gap: SPACING.s, marginVertical: SPACING.m },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.l,
    marginRight: SPACING.s,
    backgroundColor: COLORS.background,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    ...SHADOWS.small,
  },
  chipDisabled: { opacity: 0.4 },
  chipText: { color: COLORS.textSecondary, fontWeight: '500' },
  chipTextSelected: { color: '#fff', fontWeight: '700' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.s,
    paddingTop: SPACING.s,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalText: { fontSize: 18, fontWeight: '600', color: COLORS.textSecondary },
  totalValue: { fontSize: 24, fontWeight: 'bold', color: COLORS.primary },
  primaryBtn: {
    backgroundColor: COLORS.success,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.l,
    alignItems: 'center',
    marginTop: SPACING.m,
    ...SHADOWS.medium,
  },
  primaryBtnDisabled: { opacity: 0.6, backgroundColor: COLORS.muted },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  loadingBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '80%',
    padding: SPACING.l,
    ...SHADOWS.large,
  },
  modalTitle: {
    ...TYPOGRAPHY.h2,
    marginBottom: SPACING.m,
    textAlign: 'center',
  },
  listItem: {
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listTitle: { fontWeight: 'bold', color: COLORS.textPrimary, fontSize: 16 },
  listSubtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  badge: {
    backgroundColor: COLORS.primaryLight,
    color: COLORS.primaryDark,
    paddingHorizontal: SPACING.s,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.s,
    fontSize: 10,
    fontWeight: 'bold',
    overflow: 'hidden',
  },
  secondaryBtn: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.l,
    alignItems: 'center',
    marginTop: SPACING.m,
  },
  secondaryBtnText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  note: {
    marginTop: SPACING.m,
    color: COLORS.muted,
    textAlign: 'center',
    fontSize: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.m,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    marginVertical: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: SPACING.s,
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
  },
  clearButtonText: {
    fontSize: 18,
    color: COLORS.muted,
  },
  searchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: SPACING.s,
  },
  resultCount: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: SPACING.s,
    textAlign: 'right',
  },
  emptySearch: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: 16,
    color: COLORS.muted,
    fontStyle: 'italic',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
});
