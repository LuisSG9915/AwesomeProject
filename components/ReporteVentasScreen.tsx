import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Modal, ScrollView, Alert, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import TicketPrinter from '../services/TicketPrinter';
import FullSyncService from '../services/FullSyncService';

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
  nombreProducto?: string;
  cantProducto?: number;
  precio?: number;
};

type TicketLine = string;

export default function ReporteVentasScreen() {
  const today = useMemo(() => new Date(), []);

  const formatDate = (date: Date): string => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const [fecha1, setFecha1] = useState<Date>(today);
  const [fecha2, setFecha2] = useState<Date>(today);
  const [showPicker1, setShowPicker1] = useState(false);
  const [showPicker2, setShowPicker2] = useState(false);
  const [items, setItems] = useState<ReporteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [allVentas, setAllVentas] = useState<any[]>([]);

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

  useEffect(() => {
    loadVentas();
  }, []);

  const loadVentas = async () => {
    try {
      await FullSyncService.initialize();
      const ventas = FullSyncService.getVentas(500);
      setAllVentas(ventas);
    } catch (error) {
      console.error('Error al cargar ventas:', error);
      Alert.alert('Error', 'No se pudieron cargar las ventas de la base local');
    }
  };

  const onChangeFecha1 = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker1(false);
    }
    if (selectedDate) {
      setFecha1(selectedDate);
    }
  };

  const onChangeFecha2 = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker2(false);
    }
    if (selectedDate) {
      setFecha2(selectedDate);
    }
  };

  const mapTipoPago = (tipo: number | undefined): 'Efectivo' | 'Credito' | 'Transferencia' => {
    if (tipo === 1) return 'Efectivo';
    if (tipo === 2) return 'Credito';
    if (tipo === 3) return 'Transferencia';
    return 'Efectivo';
  };

  const consultar = () => {
    setLoading(true);
    try {
      if (!fecha1 || !fecha2) {
        Alert.alert('Error', 'Selecciona ambas fechas');
        setLoading(false);
        return;
      }

      // Crear copias para no mutar los estados
      const fecha1Parsed = new Date(fecha1);
      const fecha2Parsed = new Date(fecha2);
      fecha2Parsed.setHours(23, 59, 59, 999);

      const filtered = allVentas.filter(venta => {
        if (!venta.fecha) return false;
        const ventaDate = new Date(venta.fecha);
        return ventaDate >= fecha1Parsed && ventaDate <= fecha2Parsed;
      });

      const mapped: ReporteItem[] = filtered.map(venta => ({
        id: venta.id,
        no_venta: venta.noVenta || 0,
        fecha: venta.fecha ? new Date(venta.fecha).toISOString() : new Date().toISOString(),
        nombre: venta.nombreCliente || 'Sin nombre',
        importe: venta.importe || 0,
        tipoPago: mapTipoPago(venta.tipoPago),
        facturacion: venta.folioFactura || false,
        timbrado: '0',
        sucursal: venta.sucursal,
        cve_cliente: venta.cveCliente,
        nombreProducto: venta.nombreProducto,
        cantProducto: venta.cantProducto,
        precio: venta.precio,
      }));

      setItems(mapped);
    } catch (error) {
      console.error('Error al filtrar ventas:', error);
      Alert.alert('Error', 'Ocurrió un error al consultar las ventas');
    } finally {
      setLoading(false);
    }
  };

  const generateTicket = (row: ReporteItem): TicketLine[] => {
    const lines: string[] = [];
    lines.push('================================');
    lines.push('            TICKET');
    lines.push('================================');
    lines.push(`VENTA: ${row.no_venta}`);
    lines.push(`FECHA: ${new Date(row.fecha).toLocaleString()}`);
    lines.push(`CLIENTE: ${row.nombre}`);
    if (row.nombreProducto) {
      lines.push('--------------------------------');
      lines.push(`PRODUCTO: ${row.nombreProducto}`);
      if (row.cantProducto) lines.push(`CANTIDAD: ${row.cantProducto}`);
      if (row.precio) lines.push(`PRECIO UNIT: $${row.precio.toFixed(2)}`);
    }
    lines.push('--------------------------------');
    lines.push(`PAGO: ${row.tipoPago}`);
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
      <View style={styles.titleRow}>
        <Text style={styles.title}>Consulta a Ventas</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={loadVentas}
        >
          <Text style={styles.refreshIcon}>🔄</Text>
        </TouchableOpacity>
      </View>

      {allVentas.length > 0 && (
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            📊 {allVentas.length} ventas sincronizadas en la base local
          </Text>
        </View>
      )}

      {allVentas.length === 0 && (
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>
            No hay ventas sincronizadas. Inicia sesión nuevamente o sincroniza desde el menú principal.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.formLabel}>Fecha inicial</Text>
            <TouchableOpacity 
              style={styles.dateInput}
              onPress={() => setShowPicker1(true)}
            >
              <Text style={styles.dateText}>📅 {formatDate(fecha1)}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.col}>
            <Text style={styles.formLabel}>Fecha final</Text>
            <TouchableOpacity 
              style={styles.dateInput}
              onPress={() => setShowPicker2(true)}
            >
              <Text style={styles.dateText}>📅 {formatDate(fecha2)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showPicker1 && (
          <>
            {Platform.OS === 'ios' && (
              <View style={styles.iosPickerContainer}>
                <View style={styles.iosPickerHeader}>
                  <TouchableOpacity onPress={() => setShowPicker1(false)}>
                    <Text style={styles.iosPickerButton}>Listo</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={fecha1}
                  mode="date"
                  display="spinner"
                  onChange={onChangeFecha1}
                  maximumDate={new Date()}
                  style={styles.iosPicker}
                />
              </View>
            )}
            {Platform.OS === 'android' && (
              <DateTimePicker
                value={fecha1}
                mode="date"
                display="default"
                onChange={onChangeFecha1}
                maximumDate={new Date()}
              />
            )}
          </>
        )}

        {showPicker2 && (
          <>
            {Platform.OS === 'ios' && (
              <View style={styles.iosPickerContainer}>
                <View style={styles.iosPickerHeader}>
                  <TouchableOpacity onPress={() => setShowPicker2(false)}>
                    <Text style={styles.iosPickerButton}>Listo</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={fecha2}
                  mode="date"
                  display="spinner"
                  onChange={onChangeFecha2}
                  maximumDate={new Date()}
                  style={styles.iosPicker}
                />
              </View>
            )}
            {Platform.OS === 'android' && (
              <DateTimePicker
                value={fecha2}
                mode="date"
                display="default"
                onChange={onChangeFecha2}
                maximumDate={new Date()}
              />
            )}
          </>
        )}
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
  titleRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  title: { fontSize: 22, fontWeight: 'bold' },
  refreshButton: {
    backgroundColor: '#1976D2',
    borderRadius: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  refreshIcon: { fontSize: 20 },
  infoCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#1976D2',
  },
  infoText: {
    color: '#0D47A1',
    fontSize: 14,
    fontWeight: '600',
  },
  warningCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  warningIcon: { fontSize: 24 },
  warningText: {
    flex: 1,
    color: '#E65100',
    fontSize: 14,
    fontWeight: '500',
  },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  formLabel: { fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginTop: 4 },
  dateInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#1976D2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
    shadowColor: '#1976D2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1976D2',
  },
  iosPickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  iosPickerHeader: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  iosPickerButton: {
    color: '#1976D2',
    fontSize: 16,
    fontWeight: '600',
  },
  iosPicker: {
    width: '100%',
    height: 200,
  },
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
