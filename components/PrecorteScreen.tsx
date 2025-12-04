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
import { Icon } from 'react-native-elements';
import TicketPrinter from '../services/TicketPrinter';
import BluetoothPrinterService from '../services/BluetoothPrinterService';
import FullSyncService from '../services/FullSyncService';
import AuthService from '../services/AuthService';
import {
  COLORS,
  SPACING,
  SHADOWS,
  BORDER_RADIUS,
  TYPOGRAPHY,
} from '../theme/theme';

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
    const now = new Date();
    // Convertir a hora de México (UTC-6)
    const mexicoOffset = -6 * 60; // -6 horas en minutos
    const localOffset = now.getTimezoneOffset(); // offset actual en minutos
    const diffMinutes = localOffset - mexicoOffset;
    const mexicoDate = new Date(now.getTime() - diffMinutes * 60 * 1000);

    const yyyy = mexicoDate.getFullYear();
    const mm = String(mexicoDate.getMonth() + 1).padStart(2, '0');
    const dd = String(mexicoDate.getDate()).padStart(2, '0');
    console.log('Fecha actual en horario México:', yyyy, mm, dd);
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [fecha, setFecha] = useState(today);
  const [items, setItems] = useState<PrecorteItem[]>([]);
  const [totalEfectivo, setTotalEfectivo] = useState(1234.56);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [printerName, setPrinterName] = useState<string>('');

  const loadInventario = async () => {
    try {
      // Parsear la fecha seleccionada (YYYY-MM-DD) a un rango de día LOCAL
      // para usarlo tanto en el filtro de inventario como en el cálculo de ventas
      const [yearStr, monthStr, dayStr] = fecha.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const day = parseInt(dayStr, 10);

      const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
      const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

      await FullSyncService.initialize();
      const inventario = FullSyncService.getInventario(500) || [];
      const currentUser = AuthService.currentUser;
      const sucursalUsuario =
        currentUser?.sucursal_origen || currentUser?.sucursal;
      console.log(
        'Inventario',
        inventario,
        'Sucursal usuario:',
        sucursalUsuario,
      );

      // Filtrar por fechaArrastre dentro del día seleccionado Y por sucursal
      const inventarioFiltrado = inventario.filter((inv: any) => {
        const fa = inv.fechaArrastre;
        if (!fa) return false;
        const d = fa instanceof Date ? fa : new Date(fa);
        const inDateRange = d >= startOfDay && d <= endOfDay;
        const inSucursal =
          sucursalUsuario === undefined || inv.sucursal === sucursalUsuario;
        return inDateRange && inSucursal;
      });
      // console.log('inventarioFiltrado', inventarioFiltrado);
      const mapped: PrecorteItem[] = inventarioFiltrado.map(
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

      // Calcular total efectivo desde ventas (tipoPago 1) para la fecha seleccionada y sucursal actual
      const totalEf = FullSyncService.getVentasTotalEfectivoForDate(
        startOfDay,
        sucursalUsuario ?? undefined,
      );
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
            <Icon
              name="print"
              type="material"
              size={14}
              color="#fff"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.printerBadgeText}>
              {printerName || 'Conectada'}
            </Text>
          </View>
        )}
      </View>

      {!printerConnected && (
        <View style={styles.warningCard}>
          <Icon
            name="warning"
            type="material"
            color={COLORS.warning}
            size={24}
          />
          <Text style={styles.warningText}>
            No hay impresora configurada. Ve a Configuración de Impresora para
            conectar una.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.row}>
          <Icon name="event" type="material" color={COLORS.primary} size={24} />
          <Text style={styles.formLabel}>Fecha</Text>
        </View>
        <View style={styles.dateContainer}>
          <TextInput
            value={fecha}
            onChangeText={setFecha}
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.muted}
          />
        </View>
        <TouchableOpacity style={styles.secondaryBtn} onPress={consultar}>
          <Text style={styles.secondaryBtnText}>Consultar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Icon name="list" type="material" color={COLORS.primary} size={24} />
          <Text style={styles.cardTitle}>Detalle del Inventario</Text>
        </View>

        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 2 }]}>Producto</Text>
            <Text style={styles.thRight}>Saldo</Text>
          </View>
          {items.length === 0 ? (
            <Text style={styles.muted}>No hay datos para mostrar</Text>
          ) : (
            <FlatList
              data={items}
              keyExtractor={i => String(i.id)}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.tr}>
                  <Text style={[styles.td, { flex: 2 }]}>
                    {item.descripcion}
                  </Text>
                  <Text
                    style={[
                      styles.tdRight,
                      item.ifValue < 0 && styles.negative,
                    ]}
                  >
                    {item.ifValue.toFixed(2)}
                  </Text>
                </View>
              )}
            />
          )}
        </View>

        <View style={styles.footerBox}>
          <Text style={styles.footerLabel}>Total Efectivo Recaudado</Text>
          <Text style={styles.footerValue}>${totalEfectivo.toFixed(2)}</Text>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={imprimir}>
          <Icon
            name="print"
            type="material"
            color="#fff"
            size={20}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.primaryBtnText}>Imprimir Reporte</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  printerBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.l,
    flexDirection: 'row',
    alignItems: 'center',
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    marginBottom: SPACING.s,
  },
  cardTitle: { ...TYPOGRAPHY.h3, fontSize: 18, marginBottom: 0 },
  formLabel: { ...TYPOGRAPHY.h3, fontSize: 16, marginBottom: 0 },
  dateContainer: {
    marginTop: SPACING.s,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.m,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  tableContainer: {
    marginTop: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.m,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.m,
    backgroundColor: COLORS.primaryLight,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  th: { flex: 1, fontWeight: '700', color: COLORS.primaryDark },
  thRight: {
    flex: 1,
    fontWeight: '700',
    color: COLORS.primaryDark,
    textAlign: 'right',
  },
  tr: {
    flexDirection: 'row',
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  td: { flex: 1, color: COLORS.textPrimary, fontSize: 14 },
  tdRight: {
    flex: 1,
    textAlign: 'right',
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  negative: { color: COLORS.error },
  muted: { color: COLORS.muted, padding: SPACING.m, textAlign: 'center' },
  footerBox: {
    marginTop: SPACING.m,
    padding: SPACING.m,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.m,
    alignItems: 'center',
  },
  footerLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  footerValue: {
    color: COLORS.success,
    fontSize: 24,
    fontWeight: 'bold',
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.l,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.l,
    flexDirection: 'row',
    ...SHADOWS.medium,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.l,
    alignItems: 'center',
    marginTop: SPACING.m,
  },
  secondaryBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 16 },
});
