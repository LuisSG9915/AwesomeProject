import React, { useMemo, useState, useEffect } from 'react';
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

type Cliente = {
  id: number;
  nombre: string;
  credito?: boolean;
};

type Producto = {
  id: number;
  descripcion: string;
  precio: number;
};

type CartItem = Producto & { cantidad: number };

export default function SalesScreen() {
  const [clientes] = useState<Cliente[]>([
    { id: 1, nombre: 'Cliente Mostrador', credito: false },
    { id: 2, nombre: 'Cliente Crédito', credito: true },
  ]);
  const [productos] = useState<Producto[]>([
    { id: 101, descripcion: 'Producto A', precio: 25.5 },
    { id: 102, descripcion: 'Producto B', precio: 42.0 },
    { id: 103, descripcion: 'Producto C', precio: 12.75 },
  ]);

  const [clienteModalOpen, setClienteModalOpen] = useState(false);
  const [productoModalOpen, setProductoModalOpen] = useState(false);

  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'credito' | null>(null);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [printerName, setPrinterName] = useState<string>('');

  useEffect(() => {
    const status = BluetoothPrinterService.getStatus();
    setPrinterConnected(status.connected);
    setPrinterName(status.printer?.name || '');
  }, []);

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

  const processSale = async () => {
    if (!selectedClient) {
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
      // Usar el nuevo servicio de tickets mejorado
      await TicketPrinter.printSaleTicket({
        clientName: selectedClient.nombre,
        paymentMethod: metodoPago,
        items: cart.map(item => ({
          description: item.descripcion,
          quantity: item.cantidad,
          price: item.precio,
          total: item.precio * item.cantidad,
        })),
        total: total,
        businessName: 'Sistema de Gestión',
      });

      // Actualizar estado de impresora
      const status = BluetoothPrinterService.getStatus();
      setPrinterConnected(status.connected);
      
      if (status.connected) {
        Alert.alert(
          '🖨️ Venta Procesada',
          `Cliente: ${selectedClient.nombre}\nTotal: $${total.toFixed(2)}\nPago: ${metodoPago}\n\nTicket enviado a: ${status.printer?.name}`,
        );
      } else {
        Alert.alert(
          '✅ Venta Procesada',
          `Cliente: ${selectedClient.nombre}\nTotal: $${total.toFixed(2)}\nPago: ${metodoPago}`,
        );
      }

      // Limpiar formulario
      setCart([]);
      setMetodoPago(null);
      setSelectedClient(null);
    } catch (error) {
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
            <Text style={styles.printerBadgeText}>🖨️ {printerName || 'OK'}</Text>
          </View>
        )}
      </View>

      {!printerConnected && (
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>
            Sin impresora. Los tickets se compartirán o deberás configurar una.
          </Text>
        </View>
      )}

      {/* Cliente */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Cliente</Text>
          <TouchableOpacity style={styles.smallBtn} onPress={() => setClienteModalOpen(true)}>
            <Text style={styles.smallBtnText}>Seleccionar</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.valueText}>{selectedClient ? selectedClient.nombre : 'Sin seleccionar'}</Text>
      </View>

      {/* Productos */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Productos</Text>
          <TouchableOpacity
            style={[styles.smallBtn, !selectedClient && styles.smallBtnDisabled]}
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
                      if (Number.isFinite(n) && n > 0) updateQuantity(item.id, n);
                    }}
                  />
                </View>
                <Text style={styles.lineTotal}>${(item.precio * item.cantidad).toFixed(2)}</Text>
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeFromCart(item.id)}>
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
          style={[styles.primaryBtn, (!selectedClient || !cart.length || !metodoPago) && styles.primaryBtnDisabled]}
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
            <FlatList
              data={clientes}
              keyExtractor={i => String(i.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.listItem}
                  onPress={() => {
                    setSelectedClient(item);
                    setClienteModalOpen(false);
                  }}
                >
                  <Text style={styles.listTitle}>{item.nombre}</Text>
                  {item.credito ? <Text style={styles.badge}>Crédito</Text> : null}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setClienteModalOpen(false)}>
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
            <FlatList
              data={productos}
              keyExtractor={i => String(i.id)}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.listItem} onPress={() => addToCart(item)}>
                  <Text style={styles.listTitle}>{item.descripcion}</Text>
                  <Text style={styles.listSubtitle}>${item.precio.toFixed(2)}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setProductoModalOpen(false)}>
              <Text style={styles.secondaryBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      </ScrollView>
    </View>
  );
}

function PayChip({ label, selected, onPress, disabled }: { label: string; selected?: boolean; onPress?: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.chip, selected && styles.chipSelected, disabled && styles.chipDisabled]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 32 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  printerBadge: {
    backgroundColor: '#4CAF50',
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
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  warningIcon: { fontSize: 20 },
  warningText: {
    flex: 1,
    color: '#E65100',
    fontSize: 13,
  },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  valueText: { marginTop: 8, color: '#333' },
  smallBtn: { backgroundColor: '#1976D2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  smallBtnDisabled: { opacity: 0.5 },
  smallBtnText: { color: '#fff', fontWeight: '600' },
  muted: { color: '#666' },
  cartList: { marginTop: 8 },
  cartRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  cartTitle: { fontWeight: '600' },
  qtyBox: { width: 56, marginHorizontal: 8 },
  qtyInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 4, textAlign: 'center' },
  lineTotal: { width: 80, textAlign: 'right', fontWeight: '600' },
  removeBtn: { padding: 8, marginLeft: 8 },
  removeBtnText: { color: '#d32f2f', fontSize: 16 },
  payRow: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  chip: { borderWidth: 1, borderColor: '#aaa', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, marginRight: 8 },
  chipSelected: { backgroundColor: '#1976D2', borderColor: '#1976D2' },
  chipDisabled: { opacity: 0.4 },
  chipText: { color: '#333' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  totalText: { fontSize: 16, fontWeight: '600' },
  totalValue: { fontSize: 18, fontWeight: 'bold' },
  primaryBtn: { backgroundColor: '#2e7d32', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%', padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  listItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  listTitle: { fontWeight: '600' },
  listSubtitle: { color: '#666' },
  badge: { backgroundColor: '#FFC107', color: '#222', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  secondaryBtn: { backgroundColor: '#e0e0e0', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  secondaryBtnText: { color: '#222', fontWeight: '700' },
  note: { marginTop: 12, color: '#666', textAlign: 'center', fontSize: 12 },
});
