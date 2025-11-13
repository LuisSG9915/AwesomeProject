import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput, Alert, ScrollView } from 'react-native';
import TicketPrinter from '../services/TicketPrinter';

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

  const [clients, setClients] = useState<Client[]>([
    { idCliente: 1, cliente: 'Cliente Uno' },
    { idCliente: 2, cliente: 'Cliente Dos' },
    { idCliente: 3, cliente: 'Cliente Tres' },
  ]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const filteredClients = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    if (!t) return clients;
    return clients.filter(c => c.cliente.toLowerCase().includes(t));
  }, [searchTerm, clients]);

  const [formasPago] = useState<FormaPago[]>([
    { id: 1, descripcion: 'Efectivo' },
    { id: 2, descripcion: 'Transferencia' },
  ]);
  const [formCre, setFormCre] = useState({ importe: 0, referencia: '' });
  const [formPago, setFormPago] = useState<FormaPago | null>(null);
  const [selectedSaldo, setSelectedSaldo] = useState<number | null>(null);

  const totalToPay = useMemo(
    () => invoices.filter(i => i.pagar).reduce((sum, i) => sum + i.importe, 0),
    [invoices],
  );
  const totalPaid = 0;

  const toggleClientModal = () => setModalClients(v => !v);
  const toggleEfectivo = () => {
    setEfectivo(v => !v);
    if (!efectivo) setFormPago({ id: 1, descripcion: 'Efectivo' });
  };
  const toggleTransferencia = () => {
    setTransferencia(v => !v);
    if (!transferencia) setFormPago({ id: 2, descripcion: 'Transferencia' });
  };

  const handleSelectClient = async (clientId: number, clientName: string) => {
    setIsLoading(true);
    setSelectedClient(clientName);
    setSelectedClientId(clientId);
    try {
      const mock: Invoice[] = [
        { id: 11, fecha: new Date().toLocaleDateString(), nota: 'A-1001', diasCred: '0', importe: 250.5, ruta: 'Local', pagar: false, saldo: 250.5, pago: 0, idSegmento: 11, sucursalSegmento: 1 },
        { id: 12, fecha: new Date().toLocaleDateString(), nota: 'A-1002', diasCred: '0', importe: 480, ruta: 'Local', pagar: false, saldo: 480, pago: 0, idSegmento: 12, sucursalSegmento: 1 },
        { id: 13, fecha: new Date().toLocaleDateString(), nota: 'A-1003', diasCred: '0', importe: 90, ruta: 'Local', pagar: false, saldo: 90, pago: 0, idSegmento: 13, sucursalSegmento: 1 },
      ];
      setInvoices(mock);
      setSelectedSaldo(mock.reduce((s, i) => s + i.saldo, 0));
    } finally {
      setIsLoading(false);
      setModalClients(false);
    }
  };

  const handleTogglePayment = (index: number) => {
    setInvoices(prev => prev.map((inv, i) => (i === index ? { ...inv, pagar: !inv.pagar } : inv)));
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
      if (formCre.importe && selectedSaldo !== null && formCre.importe > selectedSaldo) {
        Alert.alert('El importe no puede exceder el saldo');
        return;
      }

      // Imprimir ticket de pago
      try {
        const payMethod = efectivo ? 'Efectivo' : transferencia ? 'Transferencia' : 'Otro';
        await TicketPrinter.printBillingTicket(
          selectedClient,
          selected.map(inv => ({ nota: inv.nota, importe: inv.importe })),
          payMethod,
          totalToPay,
        );
      } catch (error) {
        console.error('Error al imprimir ticket:', error);
      }

      Alert.alert('✅ Pago Registrado', `Facturas: ${selected.length}\nTotal: $${totalToPay.toFixed(2)}`);
      setInvoices([]);
      setSelectedClient('');
      setSelectedClientId(null);
      setEfectivo(false);
      setTransferencia(false);
      setFormPago(null);
      setFormCre({ importe: 0, referencia: '' });
      setSelectedSaldo(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Cobranza</Text>
        <Text style={styles.badge}>Fecha: {new Date().toLocaleDateString()}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Cliente</Text>
          <TouchableOpacity style={styles.smallBtn} onPress={toggleClientModal} disabled={isLoading}>
            <Text style={styles.smallBtnText}>{isLoading ? 'Cargando...' : 'Seleccionar'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.valueText}>{selectedClient || 'Sin seleccionar'}</Text>
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
                <TouchableOpacity onPress={() => handleTogglePayment(idx)} style={[styles.checkBox, inv.pagar && styles.checkBoxOn]} />
              </View>
            ))}
            <View style={styles.totalsBox}>
              <View style={styles.rowBetween}><Text>Total pagado</Text><Text style={styles.moneySmall}>${totalPaid.toFixed(2)}</Text></View>
              <View style={styles.rowBetween}><Text>Total a pagar</Text><Text style={styles.moneySmall}>${totalToPay.toFixed(2)}</Text></View>
            </View>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Método de pago</Text>
        <View style={styles.payRow}>
          <Chip label="Efectivo" selected={efectivo} onPress={toggleEfectivo} />
          <Chip label="Transferencia" selected={transferencia} onPress={toggleTransferencia} />
        </View>

        {selectedSaldo !== null && (
          <View style={styles.formBox}>
            <Text style={styles.formLabel}>Importe</Text>
            <TextInput
              value={String(formCre.importe || '')}
              onChangeText={t => setFormCre({ ...formCre, importe: parseFloat(t || '0') })}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="0.00"
            />
            <Text style={styles.hint}>Saldo pendiente: ${selectedSaldo.toFixed(2)}</Text>

            <Text style={[styles.formLabel, { marginTop: 8 }]}>Forma de pago</Text>
            <View style={styles.rowWrap}>
              {formasPago.map(fp => (
                <TouchableOpacity key={fp.id} style={[styles.pill, formPago?.id === fp.id && styles.pillOn]} onPress={() => setFormPago(fp)}>
                  <Text style={[styles.pillText, formPago?.id === fp.id && styles.pillTextOn]}>{fp.descripcion}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.formLabel, { marginTop: 8 }]}>Referencia</Text>
            <TextInput
              value={formCre.referencia}
              onChangeText={t => setFormCre({ ...formCre, referencia: t })}
              style={styles.input}
              placeholder="Referencia"
            />

            <TouchableOpacity style={[styles.primaryBtn, (isProcessing) && styles.primaryBtnDisabled]} onPress={insertar} disabled={isProcessing}>
              <Text style={styles.primaryBtnText}>{isProcessing ? 'Procesando...' : 'Realizar Pago de Crédito'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.successBtn, (totalToPay <= 0 || isProcessing) && styles.primaryBtnDisabled]}
          onPress={insertar}
          disabled={totalToPay <= 0 || isProcessing}
        >
          <Text style={styles.successBtnText}>{isProcessing ? 'Procesando...' : 'Guardar Pago'}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalClients} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Seleccionar Cliente</Text>
            <TextInput placeholder="Buscar cliente..." value={searchTerm} onChangeText={setSearchTerm} style={styles.input} />
            <FlatList
              data={filteredClients}
              keyExtractor={i => String(i.idCliente)}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.listItem} onPress={() => handleSelectClient(item.idCliente, item.cliente)}>
                  <Text style={styles.listTitle}>{item.cliente}</Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 300 }}
            />
            <TouchableOpacity style={styles.secondaryBtn} onPress={toggleClientModal}><Text style={styles.secondaryBtnText}>Cerrar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 'bold' },
  badge: { backgroundColor: '#eee', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontWeight: '600', fontSize: 16 },
  valueText: { marginTop: 8, color: '#333' },
  smallBtn: { backgroundColor: '#1976D2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  smallBtnText: { color: '#fff', fontWeight: '600' },
  muted: { color: '#666' },
  invRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  invTitle: { fontWeight: '600' },
  money: { width: 100, textAlign: 'right', fontWeight: '600' },
  checkBox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#999', marginLeft: 10 },
  checkBoxOn: { backgroundColor: '#1976D2', borderColor: '#1976D2' },
  totalsBox: { backgroundColor: '#fafafa', padding: 10, borderRadius: 8, marginTop: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  pill: { borderWidth: 1, borderColor: '#bbb', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, marginRight: 8, marginTop: 6 },
  pillOn: { backgroundColor: '#1976D2', borderColor: '#1976D2' },
  pillText: { color: '#333' },
  pillTextOn: { color: '#fff', fontWeight: '600' },
  moneySmall: { fontWeight: '600' },
  payRow: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  chip: { borderWidth: 1, borderColor: '#aaa', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, marginRight: 8 },
  chipOn: { backgroundColor: '#1976D2', borderColor: '#1976D2' },
  chipText: { color: '#333' },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  formBox: { marginTop: 8 },
  formLabel: { fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  hint: { color: '#666' },
  primaryBtn: { backgroundColor: '#1976D2', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  successBtn: { backgroundColor: '#2e7d32', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  successBtnText: { color: '#fff', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%', padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  listItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  listTitle: { fontWeight: '600' },
  secondaryBtn: { backgroundColor: '#e0e0e0', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  secondaryBtnText: { color: '#222', fontWeight: '700' },
});
