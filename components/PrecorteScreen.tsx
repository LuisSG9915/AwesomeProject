import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import TicketPrinter from '../services/TicketPrinter';
import BluetoothPrinterService from '../services/BluetoothPrinterService';
import FullSyncService from '../services/FullSyncService';
import { COLORS } from '../theme/theme';

type PrecorteItem = {
  id: number;
  clave_prod: string;
  descripcion: string;
  entradas: number;
  salidas: number;
  ifValue: number;
};

export default function PrecorteScreen() {
  const today = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [fecha, setFecha] = useState(today);
  const [items, setItems] = useState<PrecorteItem[]>([]);
  const [totalEfectivo, setTotalEfectivo] = useState(1234.56);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [printerName, setPrinterName] = useState<string>('');

  const loadInventario = async () => {
    try {
      await FullSyncService.initialize();
      const inventario = FullSyncService.getInventario(500) || [];
      console.log(inventario);
      const mapped: PrecorteItem[] = inventario.map(
        (inv: any, index: number) => ({
          id: inv.id ?? index,
          clave_prod: String(inv.claveProd ?? ''),
          descripcion:
            (inv.descripcion as string | undefined) ??
            String(inv.claveProd ?? ''),
          entradas: 0,
          salidas: 0,
          ifValue: inv.saldo ?? 0,
        }),
      );

      setItems(mapped);

      // Calcular total efectivo desde ventas (tipoPago 1) para la fecha seleccionada
      // OJO: el string "YYYY-MM-DD" lo parseamos como fecha LOCAL para evitar corrimientos por UTC
      const [yearStr, monthStr, dayStr] = fecha.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const day = parseInt(dayStr, 10);
      const fechaDate = new Date(year, month - 1, day); // fecha local a medianoche

      const totalEf = FullSyncService.getVentasTotalEfectivoForDate(fechaDate);
      setTotalEfectivo(totalEf);
    } catch (error) {
      console.error('Error al cargar inventario para precorte:', error);
      Alert.alert('Error', 'No se pudo cargar el inventario para el precorte');
    }
  };

  useEffect(() => {
    const status = BluetoothPrinterService.getStatus();
    setPrinterConnected(status.connected);
    setPrinterName(status.printer?.name || '');
    loadInventario();
  }, []);

  const consultar = () => {
    loadInventario();
  };

  const imprimir = async () => {
    try {
      await TicketPrinter.printPrecorteTicket({
        date: new Date(fecha),
        items: items.map(it => ({
          product: it.descripcion,
          entries: it.entradas,
          exits: it.salidas,
          inventory: it.ifValue,
        })),
        totalCash: totalEfectivo,
      });

      // Actualizar estado de impresora
      const status = BluetoothPrinterService.getStatus();
      setPrinterConnected(status.connected);

      if (status.connected) {
        Alert.alert('🖨️ Impreso', `Ticket enviado a ${status.printer?.name}`);
      }
    } catch (error) {
      Alert.alert('❌ Error', 'No se pudo imprimir el precorte');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Precorte</Text>
        {printerConnected && (
          <View style={styles.printerBadge}>
            <Text style={styles.printerBadgeText}>
              🖨️ {printerName || 'Conectada'}
            </Text>
          </View>
        )}
      </View>

      {!printerConnected && (
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>
            No hay impresora configurada. Ve a Configuración de Impresora para
            conectar una.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.formLabel}>Fecha</Text>
        <TextInput
          value={fecha}
          onChangeText={setFecha}
          style={styles.input}
          placeholder="YYYY-MM-DD"
        />
        <TouchableOpacity style={styles.secondaryBtn} onPress={consultar}>
          <Text style={styles.secondaryBtnText}>Consultar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Detalle</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 2 }]}>Producto</Text>
          {/* <Text style={styles.th}>Entradas</Text>
          <Text style={styles.th}>Salidas</Text> */}
          <Text style={styles.th}>Saldo</Text>
        </View>
        {items.length === 0 ? (
          <Text style={styles.muted}>No hay datos</Text>
        ) : (
          <FlatList
            data={items}
            keyExtractor={i => String(i.id)}
            renderItem={({ item }) => (
              <View style={styles.tr}>
                <Text style={[styles.td, { flex: 2 }]}>{item.descripcion}</Text>
                {/* <Text style={styles.tdCenter}>{item.entradas.toFixed(2)}</Text>
                <Text style={styles.tdCenter}>{item.salidas.toFixed(2)}</Text> */}
                <Text style={styles.tdCenter}>{item.ifValue.toFixed(2)}</Text>
              </View>
            )}
          />
        )}

        <View style={styles.footerBox}>
          <Text style={styles.footerText}>
            Total efectivo: ${totalEfectivo.toFixed(2)}
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={imprimir}>
          <Text style={styles.primaryBtnText}>Imprimir</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
    color: COLORS.warning,
    fontSize: 13,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: { fontWeight: '600', fontSize: 16, marginBottom: 8 },
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
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  th: { flex: 1, fontWeight: '700' },
  tr: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  td: { flex: 1 },
  tdCenter: { flex: 1, textAlign: 'center' },
  muted: { color: COLORS.textSecondary, marginTop: 8 },
  footerBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footerText: { fontWeight: '700' },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: '#e0e0e0',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryBtnText: { color: '#222', fontWeight: '700' },
});
