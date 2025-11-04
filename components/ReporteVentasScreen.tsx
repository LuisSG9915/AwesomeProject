import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Modal, ScrollView, Alert } from 'react-native';
import TicketPrinter from '../services/TicketPrinter';

type ReporteItem = {
  id: number;
  no_venta: number;
  fecha: string;
  nombre: string;
  importe: number;
  tipoPago: 'Efectivo' | 'Credito' | 'Transferencia';
  facturacion?: boolean;
  timbrado?: '0' | '1';
  sucursal?: number;
  caja?: number;
  cve_cliente?: number;
};

type TicketLine = string;

export default function ReporteVentasScreen() {
  const today = useMemo(() => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }, []);

  const [fecha1, setFecha1] = useState(today);
  const [fecha2, setFecha2] = useState(today);
  const [items, setItems] = useState<ReporteItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [ticketVisible, setTicketVisible] = useState(false);
  const [ticketContent, setTicketContent] = useState<TicketLine[]>([]);

  const total = useMemo(() => items.reduce((s, i) => s + i.importe, 0), [items]);
  const totalEfectivo = useMemo(
    () => items.filter(i => i.tipoPago === 'Efectivo').reduce((s, i) => s + i.importe, 0),
    [items],
  );
  const totalCredito = useMemo(
    () => items.filter(i => i.tipoPago === 'Credito').reduce((s, i) => s + i.importe, 0),
    [items],
  );

  const consultar = () => {
    setLoading(true);
    setTimeout(() => {
      const mock: ReporteItem[] = [
        { id: 1, no_venta: 1001, fecha: new Date().toISOString(), nombre: 'Cliente Uno', importe: 250.5, tipoPago: 'Efectivo', facturacion: true, timbrado: '0', sucursal: 1, caja: 1, cve_cliente: 10 },
        { id: 2, no_venta: 1002, fecha: new Date().toISOString(), nombre: 'Cliente Dos', importe: 480, tipoPago: 'Transferencia', facturacion: true, timbrado: '1', sucursal: 1, caja: 1, cve_cliente: 11 },
        { id: 3, no_venta: 1003, fecha: new Date().toISOString(), nombre: 'Cliente Tres', importe: 90, tipoPago: 'Credito', facturacion: false, timbrado: '0', sucursal: 1, caja: 1, cve_cliente: 12 },
      ];
      setItems(mock);
      setLoading(false);
    }, 500);
  };

  const generateTicket = (row: ReporteItem): TicketLine[] => {
    const lines: string[] = [];
    lines.push('================================');
    lines.push('            TICKET');
    lines.push('================================');
    lines.push(`VENTA: ${row.no_venta}`);
    lines.push(`FECHA: ${new Date(row.fecha).toLocaleString()}`);
    lines.push(`CLIENTE: ${row.nombre}`);
    lines.push(`PAGO: ${row.tipoPago}`);
    lines.push('--------------------------------');
    lines.push(`TOTAL: $${row.importe.toFixed(2)}`);
    lines.push('================================');
    return lines;
  };

  const visualizarTicket = (row: ReporteItem) => {
    setTicketContent(generateTicket(row));
    setTicketVisible(true);
  };

  const imprimirTicket = async (row: ReporteItem) => {
    const lines = generateTicket(row);
    await TicketPrinter.print(lines, 'Ticket de Venta');
  };

  const facturarVenta = (row: ReporteItem) => {
    Alert.alert('Facturación (simulada)', row.timbrado === '1' ? 'Reimprimiendo CFDI...' : 'Generando factura...');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Consulta a Ventas</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.formLabel}>Fecha inicial</Text>
            <TextInput placeholder="DD/MM/YYYY" value={fecha1} onChangeText={setFecha1} style={styles.input} />
          </View>
          <View style={styles.col}>
            <Text style={styles.formLabel}>Fecha final</Text>
            <TextInput placeholder="DD/MM/YYYY" value={fecha2} onChangeText={setFecha2} style={styles.input} />
          </View>
        </View>
        <TouchableOpacity style={styles.secondaryBtn} onPress={consultar} disabled={loading}>
          <Text style={styles.secondaryBtnText}>{loading ? 'Cargando...' : 'Consultar'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Resultados</Text>
        {items.length === 0 ? (
          <Text style={styles.muted}>Sin resultados</Text>
        ) : (
          <FlatList
            data={items}
            keyExtractor={i => String(i.id)}
            renderItem={({ item }) => (
              <View style={styles.rowItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invTitle}>#{item.no_venta} • {item.nombre}</Text>
                  <Text style={styles.muted}>{new Date(item.fecha).toLocaleDateString()} • {item.tipoPago}</Text>
                </View>
                <Text style={styles.money}>${item.importe.toFixed(2)}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <TouchableOpacity onPress={() => imprimirTicket(item)}><Text style={styles.link}>Imprimir</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => visualizarTicket(item)}><Text style={styles.link}>Visualizar</Text></TouchableOpacity>
                  {item.facturacion && item.no_venta > 1 && (
                    <TouchableOpacity onPress={() => facturarVenta(item)}>
                      <Text style={styles.link}>{item.timbrado === '1' ? 'Reimprimir' : 'Facturar'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          />
        )}

        {items.length > 0 && (
          <View style={styles.totalsBox}>
            <View style={styles.rowBetween}><Text>Total</Text><Text style={styles.moneySmall}>${total.toFixed(2)}</Text></View>
            <View style={styles.rowBetween}><Text>Total Efectivo</Text><Text style={styles.moneySmall}>${totalEfectivo.toFixed(2)}</Text></View>
            <View style={styles.rowBetween}><Text>Total Créditos</Text><Text style={styles.moneySmall}>${totalCredito.toFixed(2)}</Text></View>
          </View>
        )}
      </View>

      <Modal visible={ticketVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Visualización del Ticket</Text>
              <TouchableOpacity onPress={() => setTicketVisible(false)}><Text style={styles.link}>Cerrar</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {ticketContent.map((line, idx) => (
                <Text key={idx} style={styles.mono}>{line}</Text>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  formLabel: { fontWeight: '600' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginTop: 4 },
  secondaryBtn: { backgroundColor: '#e0e0e0', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  secondaryBtnText: { color: '#222', fontWeight: '700' },
  cardTitle: { fontWeight: '600', fontSize: 16, marginBottom: 8 },
  muted: { color: '#666' },
  row: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },
  rowItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  invTitle: { fontWeight: '600' },
  money: { width: 100, textAlign: 'right', fontWeight: '600' },
  link: { color: '#1976D2', fontWeight: '600', marginTop: 4 },
  totalsBox: { backgroundColor: '#fafafa', padding: 10, borderRadius: 8, marginTop: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  moneySmall: { fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  mono: { fontFamily: 'Courier', fontSize: 12, lineHeight: 16 },
});
