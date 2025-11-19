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
import { Icon } from 'react-native-elements';
import TicketPrinter from '../services/TicketPrinter';
import FullSyncService from '../services/FullSyncService';
import AuthService, { Usuario } from '../services/AuthService';
import {
  COLORS,
  SPACING,
  SHADOWS,
  BORDER_RADIUS,
  TYPOGRAPHY,
} from '../theme/theme';

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
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            📅 {new Date().toLocaleDateString()}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.row}>
            <Icon
              name="person"
              type="material"
              color={COLORS.primary}
              size={24}
            />
            <Text style={styles.cardTitle}>Cliente</Text>
          </View>
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
        <View style={styles.row}>
          <Icon
            name="receipt"
            type="material"
            color={COLORS.primary}
            size={24}
          />
          <Text style={styles.cardTitle}>Facturas Pendientes</Text>
        </View>
        {invoices.length === 0 ? (
          <Text style={styles.muted}>No hay facturas</Text>
        ) : (
          <View style={styles.invoiceList}>
            {invoices.map((inv, idx) => (
              <TouchableOpacity
                key={inv.id}
                style={[styles.invRow, inv.pagar && styles.invRowSelected]}
                onPress={() => handleTogglePayment(idx)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.invTitle}>{inv.nota}</Text>
                  <Text style={styles.muted}>{inv.fecha}</Text>
                </View>
                <View style={styles.amountContainer}>
                  <Text style={styles.money}>${inv.importe.toFixed(2)}</Text>
                  <View
                    style={[styles.checkBox, inv.pagar && styles.checkBoxOn]}
                  >
                    {inv.pagar && (
                      <Icon
                        name="check"
                        type="material"
                        size={14}
                        color="#fff"
                      />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            <View style={styles.totalsBox}>
              <View style={styles.rowBetween}>
                <Text style={styles.totalLabel}>Total pagado</Text>
                <Text style={styles.moneySmall}>${totalPaid.toFixed(2)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.rowBetween}>
                <Text style={styles.totalLabelMain}>Total a pagar</Text>
                <Text style={styles.totalValueMain}>
                  ${totalToPay.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Método de pago</Text>
        <View style={styles.payRow}>
          <Chip
            label="Efectivo"
            icon="attach-money"
            selected={efectivo}
            onPress={toggleEfectivo}
          />
          <Chip
            label="Transferencia"
            icon="account-balance"
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
          <Icon name="check-circle" type="material" color="#fff" size={24} />
          <Text style={styles.successBtnText}>
            {isProcessing ? 'Procesando...' : 'Registrar Cobro'}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalClients} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Seleccionar Cliente</Text>
            <View style={styles.searchContainer}>
              <Icon
                name="search"
                type="material"
                size={20}
                color={COLORS.muted}
              />
              <TextInput
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChangeText={setSearchTerm}
                style={styles.searchInput}
                placeholderTextColor={COLORS.muted}
              />
            </View>
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
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {item.cliente.charAt(0)}
                    </Text>
                  </View>
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
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
      activeOpacity={0.8}
    >
      <Icon
        name={icon}
        type="material"
        size={18}
        color={selected ? '#fff' : COLORS.textSecondary}
        style={{ marginRight: 4 }}
      />
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.m, paddingBottom: SPACING.xxl },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  title: { ...TYPOGRAPHY.h2 },
  badge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.l,
  },
  badgeText: {
    color: COLORS.primaryDark,
    fontWeight: '600',
    fontSize: 12,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.l,
    padding: SPACING.m,
    marginBottom: SPACING.m,
    ...SHADOWS.small,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
  },
  cardTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
  },
  valueText: {
    marginTop: SPACING.s,
    ...TYPOGRAPHY.body,
    paddingLeft: 32, // Align with title text
  },
  smallBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.m,
  },
  smallBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  muted: {
    color: COLORS.muted,
    fontSize: 14,
    paddingLeft: 32,
    marginTop: SPACING.s,
  },
  invoiceList: {
    marginTop: SPACING.m,
  },
  invRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderRadius: BORDER_RADIUS.s,
  },
  invRowSelected: {
    backgroundColor: COLORS.primaryLight,
  },
  invTitle: { fontWeight: '600', color: COLORS.textPrimary, fontSize: 16 },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.m,
  },
  money: {
    textAlign: 'right',
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 2,
    borderColor: COLORS.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  totalsBox: {
    backgroundColor: COLORS.background,
    padding: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
    marginTop: SPACING.m,
  },
  totalLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  totalLabelMain: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.s,
  },
  moneySmall: { fontWeight: '600', color: COLORS.textPrimary },
  totalValueMain: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  payRow: { flexDirection: 'row', gap: SPACING.s, marginVertical: SPACING.m },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.l,
    marginRight: SPACING.s,
    backgroundColor: COLORS.background,
  },
  chipOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    ...SHADOWS.small,
  },
  chipText: { color: COLORS.textSecondary, fontWeight: '500' },
  chipTextOn: { color: '#fff', fontWeight: '700' },
  primaryBtnDisabled: { opacity: 0.6, backgroundColor: COLORS.muted },
  successBtn: {
    backgroundColor: COLORS.success,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.l,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.m,
    flexDirection: 'row',
    gap: SPACING.s,
    ...SHADOWS.medium,
  },
  successBtnText: { color: '#fff', fontWeight: '700', fontSize: 18 },
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.m,
    paddingHorizontal: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.m,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.m,
    marginLeft: SPACING.s,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  listItem: {
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.m,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 18,
  },
  listTitle: { fontWeight: '600', color: COLORS.textPrimary, fontSize: 16 },
  secondaryBtn: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.l,
    alignItems: 'center',
    marginTop: SPACING.l,
  },
  secondaryBtnText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
});
