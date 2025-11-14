import React, { useEffect, useMemo, useState } from 'react';
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
import FullSyncService from '../services/FullSyncService';
import AuthService, { Usuario } from '../services/AuthService';
import { COLORS } from '../theme/theme';

type Invoice = {
  id: number;
  fecha: string;
  nota: string;
  diasCred: string;
  importe: number;
  ruta: string;
  pagar: boolean;
  saldo: number;
  pago: number;
  idSegmento?: number;
  sucursalSegmento?: number;
};

type Client = { idCliente: number; cliente: string };

type FormaPago = { id: number; descripcion: string };

export default function BillingScreen() {
  const [modalClients, setModalClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [transferencia, setTransferencia] = useState(false);
  const [efectivo, setEfectivo] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [carteraRows, setCarteraRows] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [currentUser, setCurrentUser] = useState<Usuario | null>(null);
  const [currentSucursal, setCurrentSucursal] = useState<number>(1);

  const [searchTerm, setSearchTerm] = useState('');
  const filteredClients = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    if (!t) return clients;
    return clients.filter(c => c.cliente.toLowerCase().includes(t));
  }, [searchTerm, clients]);

  useEffect(() => {
    const loadUser = async () => {
      const user = await AuthService.restoreSession();
      if (user) {
        setCurrentUser(user);
        const sucursal =
          (user.sucursal_origen as number | null | undefined) ??
          (user.sucursal as number | null | undefined) ??
          1;
        setCurrentSucursal(sucursal);
      }
    };

    loadUser();

    const loadCartera = async () => {
      try {
        setIsLoading(true);
        await FullSyncService.initialize();
        const cartera = FullSyncService.getCartera(1000) || [];

        setCarteraRows(cartera);

        const clientMap = new Map<number, string>();
        cartera.forEach((row: any) => {
          if (row.idCliente != null && row.nombreCliente) {
            if (!clientMap.has(row.idCliente)) {
              clientMap.set(row.idCliente, row.nombreCliente);
            }
          }
        });

        const listaClientes: Client[] = Array.from(clientMap.entries()).map(
          ([idCliente, cliente]) => ({ idCliente, cliente }),
        );
        setClients(listaClientes);
      } catch (error) {
        console.error('Error al cargar cartera para cobranza:', error);
        Alert.alert('Error', 'No se pudo cargar la cartera');
      } finally {
        setIsLoading(false);
      }
    };

    loadCartera();
  }, []);

  const totalToPay = useMemo(
    () => invoices.filter(i => i.pagar).reduce((sum, i) => sum + i.importe, 0),
    [invoices],
  );
  const totalPaid = 0;

  const toggleClientModal = () => setModalClients(v => !v);
  const toggleEfectivo = () => {
    setEfectivo(v => !v);
  };
  const toggleTransferencia = () => {
    setTransferencia(v => !v);
  };

  const buildMovilCarteraId = (sucursal: number): number => {
    const suffix = sucursal.toString().padStart(3, '0');
    const base = Date.now().toString();
    return Number(`${base}${suffix}`);
  };

  const handleSelectClient = async (clientId: number, clientName: string) => {
    setIsLoading(true);
    setSelectedClient(clientName);
    setSelectedClientId(clientId);
    try {
      const rows = carteraRows.filter(
        (row: any) =>
          row.idCliente === clientId && (row.saldo ?? 0) > 0 && !row.cobrado,
      );

      const mapped: Invoice[] = rows.map((row: any) => ({
        id: row.id,
        fecha: row.fecha ? row.fecha.toLocaleDateString() : '',
        nota: row.noVenta ? `Venta ${row.noVenta}` : `ID ${row.id}`,
        diasCred: '0',
        importe: row.saldo ?? 0,
        ruta: row.sucursal ? `Suc ${row.sucursal}` : '',
        pagar: false,
        saldo: row.saldo ?? 0,
        pago: 0,
        idSegmento: row.idSegmento,
        sucursalSegmento: row.sucursalSegmento,
      }));

      setInvoices(mapped);
    } finally {
      setIsLoading(false);
      setModalClients(false);
    }
  };

  const handleTogglePayment = (index: number) => {
    setInvoices(prev =>
      prev.map((inv, i) => (i === index ? { ...inv, pagar: !inv.pagar } : inv)),
    );
  };

  const insertar = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      if (!selectedClientId || !selectedClient) {
        Alert.alert('Seleccione un cliente');
        return;
      }
      if (!efectivo && !transferencia) {
        Alert.alert('Seleccione una forma de pago');
        return;
      }
      const selected = invoices.filter(i => i.pagar);
      if (!selected.length) {
        Alert.alert('Seleccione al menos una factura');
        return;
      }
      const sucursal = currentSucursal || 1;
      const baseId = buildMovilCarteraId(sucursal);
      const now = new Date();

      // Crear movimientos locales en cartera (saldo negativo indica pago)
      const movimientos = selected.map((inv, index) => {
        const origen = carteraRows.find((row: any) => row.id === inv.id);
        const saldoOriginal = origen?.saldo ?? inv.importe;
        return {
          id: baseId + index,
          idCliente: origen?.idCliente ?? selectedClientId,
          nombreCliente: origen?.nombreCliente ?? selectedClient,
          sucursal,
          sucursalSegmento: origen?.sucursalSegmento ?? null,
          saldo: -Math.abs(saldoOriginal),
          fecha: now,
          idSegmento: origen?.idSegmento ?? inv.idSegmento ?? null,
          noVenta: origen?.noVenta ?? null,
        };
      });

      try {
        await FullSyncService.createLocalCarteraMovements(movimientos);

        // Marcar renglones originales de cartera como cobrados (bit local)
        await FullSyncService.markCarteraAsPaid(selected.map(inv => inv.id));

        const payMethod = efectivo
          ? 'Efectivo'
          : transferencia
          ? 'Transferencia'
          : 'Otro';
        // await TicketPrinter.printBillingTicket(
        //   selectedClient,
        //   selected.map(inv => ({ nota: inv.nota, importe: inv.importe })),
        //   payMethod,
        //   totalToPay,
        // );

        Alert.alert(
          '✅ Pago Registrado',
          `Facturas: ${selected.length}\nTotal: $${totalToPay.toFixed(2)}`,
        );
      } catch (error) {
        console.error('Error al registrar pago en cartera:', error);
        Alert.alert('Error', 'No se pudo registrar el pago en la cartera');
      }

      setInvoices([]);
      setSelectedClient('');
      setSelectedClientId(null);
      setEfectivo(false);
      setTransferencia(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Cobranza</Text>
        <Text style={styles.badge}>
          Fecha: {new Date().toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Cliente</Text>
          <TouchableOpacity
            style={styles.smallBtn}
            onPress={toggleClientModal}
            disabled={isLoading}
          >
            <Text style={styles.smallBtnText}>
              {isLoading ? 'Cargando...' : 'Seleccionar'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.valueText}>
          {selectedClient || 'Sin seleccionar'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Facturas Pendientes</Text>
        {invoices.length === 0 ? (
          <Text style={styles.muted}>No hay facturas</Text>
        ) : (
          <View>
            {invoices.map((inv, idx) => (
              <View key={inv.id} style={styles.invRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invTitle}>{inv.nota}</Text>
                  <Text style={styles.muted}>{inv.fecha}</Text>
                </View>
                <Text style={styles.money}>${inv.importe.toFixed(2)}</Text>
                <TouchableOpacity
                  onPress={() => handleTogglePayment(idx)}
                  style={[styles.checkBox, inv.pagar && styles.checkBoxOn]}
                />
              </View>
            ))}
            <View style={styles.totalsBox}>
              <View style={styles.rowBetween}>
                <Text>Total pagado</Text>
                <Text style={styles.moneySmall}>${totalPaid.toFixed(2)}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text>Total a pagar</Text>
                <Text style={styles.moneySmall}>${totalToPay.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Método de pago</Text>
        <View style={styles.payRow}>
          <Chip label="Efectivo" selected={efectivo} onPress={toggleEfectivo} />
          <Chip
            label="Transferencia"
            selected={transferencia}
            onPress={toggleTransferencia}
          />
        </View>
        <TouchableOpacity
          style={[
            styles.successBtn,
            (totalToPay <= 0 || isProcessing) && styles.primaryBtnDisabled,
          ]}
          onPress={insertar}
          disabled={totalToPay <= 0 || isProcessing}
        >
          <Text style={styles.successBtnText}>
            {isProcessing ? 'Procesando...' : 'Guardar Pago'}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalClients} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Seleccionar Cliente</Text>
            <TextInput
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              style={styles.input}
            />
            <FlatList
              data={filteredClients}
              keyExtractor={i => String(i.idCliente)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.listItem}
                  onPress={() =>
                    handleSelectClient(item.idCliente, item.cliente)
                  }
                >
                  <Text style={styles.listTitle}>{item.cliente}</Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 300 }}
            />
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={toggleClientModal}
            >
              <Text style={styles.secondaryBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>
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
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary },
  badge: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: { fontWeight: '600', fontSize: 16, color: COLORS.textPrimary },
  valueText: { marginTop: 8, color: COLORS.textPrimary },
  smallBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  smallBtnText: { color: '#fff', fontWeight: '600' },
  muted: { color: COLORS.textSecondary },
  invRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  invTitle: { fontWeight: '600' },
  money: {
    width: 100,
    textAlign: 'right',
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#999',
    marginLeft: 10,
  },
  checkBoxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  totalsBox: {
    backgroundColor: '#fafafa',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  pill: {
    borderWidth: 1,
    borderColor: '#bbb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginTop: 6,
  },
  pillOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { color: COLORS.textPrimary },
  pillTextOn: { color: '#fff', fontWeight: '600' },
  moneySmall: { fontWeight: '600' },
  payRow: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#aaa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.textPrimary },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  formBox: { marginTop: 8 },
  formLabel: { fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  hint: { color: COLORS.textSecondary },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  successBtn: {
    backgroundColor: COLORS.success,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  successBtnText: { color: '#fff', fontWeight: '700' },
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
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  listItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  listTitle: { fontWeight: '600' },
  secondaryBtn: {
    backgroundColor: '#e0e0e0',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryBtnText: { color: '#222', fontWeight: '700' },
});
