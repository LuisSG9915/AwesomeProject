import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Icon } from 'react-native-elements';
import DateTimePicker from '@react-native-community/datetimepicker';
import FullSyncService from '../services/FullSyncService';
import AuthService, { Usuario } from '../services/AuthService';
import {
  COLORS,
  SPACING,
  SHADOWS,
  BORDER_RADIUS,
  TYPOGRAPHY,
} from '../theme/theme';

type Sucursal = { id_sucursal: number; nombre: string };

type Traspaso = {
  id: number;
  fecha: string;
  sucursalOrigen: string;
  sucursalDestino: number;
  traspaso_responsable_nombre_unique: string;
  folio: number;
  estatus: string;
};

type TraspasoDetalle = {
  descripcion: string;
  cantidad: number;
  idProducto?: number;
};

export default function TraspasoRecepcionScreen() {
  const [formFiltro, setFormFiltro] = useState({
    sucursal: 0,
  });

  const [currentUser, setCurrentUser] = useState<Usuario | null>(null);
  const [currentSucursal, setCurrentSucursal] = useState<number>(1);

  const today = useMemo(() => new Date(), []);
  const [fecha1, setFecha1] = useState<Date>(today);
  const [fecha2, setFecha2] = useState<Date>(today);
  const [showPicker1, setShowPicker1] = useState(false);
  const [showPicker2, setShowPicker2] = useState(false);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);

  const [traspasos, setTraspasos] = useState<Traspaso[]>([
    {
      id: 1,
      fecha: new Date().toISOString(),
      sucursalOrigen: 'Ruta 1',
      sucursalDestino: 1,
      traspaso_responsable_nombre_unique: 'Juan Pérez',
      folio: 1234,
      estatus: 'Pendiente',
    },
    {
      id: 2,
      fecha: new Date().toISOString(),
      sucursalOrigen: 'Ruta 2',
      sucursalDestino: 2,
      traspaso_responsable_nombre_unique: 'María López',
      folio: 2345,
      estatus: 'Pendiente',
    },
  ]);

  const [detalles] = useState<Record<number, TraspasoDetalle[]>>({
    1: [
      { descripcion: 'Producto A', cantidad: 20 },
      { descripcion: 'Producto B', cantidad: 15 },
      { descripcion: 'Producto C', cantidad: 10 },
    ],
    2: [
      { descripcion: 'Producto X', cantidad: 12 },
      { descripcion: 'Producto Y', cantidad: 7 },
    ],
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Traspaso | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const user = await AuthService.restoreSession();
      if (user) {
        setCurrentUser(user);
        const sucursal =
          (user.sucursal_origen as number | null | undefined) ??
          (user.sucursal as number | null | undefined) ??
          1;
        setCurrentSucursal(sucursal);
      }

      try {
        const apiSucursales = await FullSyncService.getSucursales();
        setSucursales(
          apiSucursales.map(s => ({
            id_sucursal: s.id,
            nombre: s.nombre,
          })),
        );
      } catch (error) {
        console.error('Error al cargar sucursales:', error);
        Alert.alert('Error', 'No se pudieron cargar las sucursales');
      }
    };

    loadData();
  }, []);

  const formatDate = (date: Date): string => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const buildMovilInventarioId = (sucursal: number): number => {
    const suffix = sucursal.toString().padStart(3, '0');
    const base = Date.now().toString();
    return Number(`${base}${suffix}`);
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

  const filteredTraspasos = useMemo(() => {
    return traspasos.filter(t =>
      formFiltro.sucursal ? t.sucursalDestino === formFiltro.sucursal : true,
    );
  }, [traspasos, formFiltro]);

  const onConsultar = () => {
    Alert.alert(
      'Búsqueda',
      `Del: ${formatDate(fecha1)}\nAl: ${formatDate(fecha2)}\nSucursal: ${
        formFiltro.sucursal || '-'
      }`,
    );
  };

  const onRecibir = () => {
    if (!selected) return;
    Alert.alert('Confirmación', '¿Está seguro de recibir este traspaso?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sí, recibir',
        onPress: () => {
          const sucursal = currentSucursal || selected.sucursalDestino || 1;
          const baseId = buildMovilInventarioId(sucursal);
          const now = new Date();
          const detallesTraspaso = selected ? detalles[selected.id] || [] : [];

          FullSyncService.createLocalInventarioMovements(
            detallesTraspaso.map((item, index) => ({
              id: baseId + index,
              sucursal,
              claveProd:
                typeof item.idProducto === 'number' ? item.idProducto : null,
              saldo: item.cantidad,
              fechaArrastre: now,
            })),
          )
            .then(() => {
              setTraspasos(prev =>
                prev.map(t =>
                  t.id === selected.id ? { ...t, estatus: 'Finalizado' } : t,
                ),
              );
              setModalOpen(false);
              Alert.alert(
                'Recibido',
                'El traspaso ha sido recibido y registrado en inventario.',
              );
            })
            .catch(error => {
              console.error(
                'Error al registrar inventario de traspaso:',
                error,
              );
              Alert.alert(
                'Error',
                'El traspaso se marcó como recibido pero no se pudo guardar en inventario.',
              );
            });
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Traspasos</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Icon
            name="person"
            type="material"
            color={COLORS.primary}
            size={24}
          />
          <Text style={styles.cardTitle}>Vendedor</Text>
        </View>
        <TextInput
          value={'Usuario Actual'}
          editable={false}
          style={[styles.input, styles.disabledInput]}
        />

        <View style={styles.row}>
          <Icon
            name="filter-list"
            type="material"
            color={COLORS.primary}
            size={24}
          />
          <Text style={styles.cardTitle}>Filtros</Text>
        </View>

        <View style={styles.dateRow}>
          <View style={styles.col}>
            <Text style={styles.smallLabel}>Desde</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setShowPicker1(true)}
            >
              <Icon
                name="event"
                type="material"
                color={COLORS.primary}
                size={20}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.dateText}>{formatDate(fecha1)}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.col}>
            <Text style={styles.smallLabel}>Hasta</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setShowPicker2(true)}
            >
              <Icon
                name="event"
                type="material"
                color={COLORS.primary}
                size={20}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.dateText}>{formatDate(fecha2)}</Text>
            </TouchableOpacity>
          </View>
        </View>
        {showPicker1 && (
          <DateTimePicker
            value={fecha1}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onChangeFecha1}
          />
        )}
        {showPicker2 && (
          <DateTimePicker
            value={fecha2}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onChangeFecha2}
          />
        )}

        <Text style={styles.smallLabel}>Sucursal destino</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: SPACING.s }}
        >
          <View style={styles.rowWrap}>
            <TouchableOpacity
              style={[styles.pill, formFiltro.sucursal === 0 && styles.pillOn]}
              onPress={() => setFormFiltro({ ...formFiltro, sucursal: 0 })}
            >
              <Text
                style={[
                  styles.pillText,
                  formFiltro.sucursal === 0 && styles.pillTextOn,
                ]}
              >
                Todas
              </Text>
            </TouchableOpacity>
            {sucursales.map(s => (
              <TouchableOpacity
                key={s.id_sucursal}
                style={[
                  styles.pill,
                  formFiltro.sucursal === s.id_sucursal && styles.pillOn,
                ]}
                onPress={() =>
                  setFormFiltro({ ...formFiltro, sucursal: s.id_sucursal })
                }
              >
                <Text
                  style={[
                    styles.pillText,
                    formFiltro.sucursal === s.id_sucursal && styles.pillTextOn,
                  ]}
                >
                  {s.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onConsultar}>
          <Text style={styles.secondaryBtnText}>Consultar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Resultados</Text>
        {filteredTraspasos.length === 0 ? (
          <Text style={styles.muted}>Sin resultados</Text>
        ) : (
          <FlatList
            data={filteredTraspasos}
            keyExtractor={i => String(i.id)}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.rowItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invTitle}>Folio {item.folio}</Text>
                  <Text style={styles.mutedRow}>
                    {item.fecha.split('T')[0]} • Origen: {item.sucursalOrigen}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text
                    style={[
                      styles.status,
                      item.estatus === 'Pendiente'
                        ? styles.statusPending
                        : styles.statusDone,
                    ]}
                  >
                    {item.estatus}
                  </Text>
                  <TouchableOpacity
                    style={styles.smallBtn}
                    onPress={() => {
                      setSelected(item);
                      setModalOpen(true);
                    }}
                  >
                    <Text style={styles.smallBtnText}>Ver Detalle</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </View>

      <Modal visible={modalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Visor de Traspaso</Text>
              <TouchableOpacity
                onPress={() => setModalOpen(false)}
                style={styles.closeBtn}
              >
                <Icon
                  name="close"
                  type="material"
                  size={24}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.infoBox}>
              <View style={styles.rowBetween}>
                <Text style={styles.folioLabel}>FOLIO</Text>
                <Text style={styles.folioValue}>#{selected?.folio}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.folioLabel}>ESTATUS</Text>
                <Text
                  style={[
                    styles.statusValue,
                    selected?.estatus === 'Pendiente'
                      ? { color: COLORS.warning }
                      : { color: COLORS.success },
                  ]}
                >
                  {selected?.estatus}
                </Text>
              </View>
              <View style={styles.divider} />
              <Text style={styles.infoText}>
                <Text style={{ fontWeight: 'bold' }}>Origen:</Text>{' '}
                {selected?.sucursalOrigen}
              </Text>
              <Text style={styles.infoText}>
                <Text style={{ fontWeight: 'bold' }}>Destino:</Text>{' '}
                {selected
                  ? sucursales.find(
                      s => s.id_sucursal === selected.sucursalDestino,
                    )?.nombre
                  : '-'}
              </Text>
            </View>

            <View style={[styles.card, { marginTop: SPACING.m, flex: 1 }]}>
              <Text style={styles.cardTitle}>Productos</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 2 }]}>Producto</Text>
                <Text style={styles.thRight}>Cant.</Text>
              </View>
              <FlatList
                data={selected ? detalles[selected.id] || [] : []}
                keyExtractor={(_, idx) => String(idx)}
                renderItem={({ item }) => (
                  <View style={styles.tr}>
                    <Text style={[styles.td, { flex: 2 }]}>
                      {item.descripcion}
                    </Text>
                    <Text style={styles.tdRight}>{item.cantidad}</Text>
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={styles.muted}>Sin productos</Text>
                }
              />
            </View>

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (selected?.estatus === 'Finalizado' ||
                  selected?.estatus === 'Cancelado') &&
                  styles.primaryBtnDisabled,
              ]}
              onPress={onRecibir}
              disabled={
                selected?.estatus === 'Finalizado' ||
                selected?.estatus === 'Cancelado'
              }
            >
              <Icon
                name="inventory"
                type="material"
                color="#fff"
                size={20}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.primaryBtnText}>Confirmar Recepción</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.m, paddingBottom: SPACING.xxl },
  title: {
    ...TYPOGRAPHY.h2,
    marginBottom: SPACING.m,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.l,
    padding: SPACING.m,
    marginBottom: SPACING.m,
    ...SHADOWS.small,
  },
  cardTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    marginBottom: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    marginBottom: SPACING.s,
    marginTop: SPACING.s,
  },
  smallLabel: {
    color: COLORS.textSecondary,
    marginBottom: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.m,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  disabledInput: {
    backgroundColor: COLORS.border,
    opacity: 0.7,
  },
  dateRow: { flexDirection: 'row', gap: SPACING.m, marginBottom: SPACING.m },
  col: { flex: 1 },
  dateInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.m,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: SPACING.s,
  },
  pill: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.l,
    backgroundColor: COLORS.background,
  },
  pillOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    ...SHADOWS.small,
  },
  pillText: { color: COLORS.textSecondary, fontWeight: '500' },
  pillTextOn: { color: '#fff', fontWeight: '700' },
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
  muted: { color: COLORS.muted, padding: SPACING.m, textAlign: 'center' },
  mutedRow: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  invTitle: { fontWeight: '600', color: COLORS.textPrimary, fontSize: 16 },
  status: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.s,
    overflow: 'hidden',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  statusPending: { backgroundColor: '#FFF3CD', color: '#F57C00' },
  statusDone: { backgroundColor: '#E8F5E9', color: '#2E7D32' },
  smallBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.s,
  },
  smallBtnText: { color: '#fff', fontWeight: '600', fontSize: 10 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    height: '90%',
    padding: SPACING.l,
    ...SHADOWS.large,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  modalTitle: { ...TYPOGRAPHY.h2, fontSize: 20, marginBottom: 0 },
  closeBtn: { padding: 4 },
  infoBox: {
    backgroundColor: COLORS.background,
    padding: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  folioLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  folioValue: { color: COLORS.textPrimary, fontSize: 14, fontWeight: 'bold' },
  statusValue: { fontSize: 14, fontWeight: 'bold' },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.s,
  },
  infoText: { color: COLORS.textPrimary, fontSize: 14, marginBottom: 2 },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.s,
    marginTop: SPACING.s,
    borderTopLeftRadius: BORDER_RADIUS.m,
    borderTopRightRadius: BORDER_RADIUS.m,
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
    paddingHorizontal: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  td: { flex: 1, color: COLORS.textPrimary },
  tdRight: {
    flex: 1,
    textAlign: 'right',
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.l,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.l,
    marginBottom: SPACING.l,
    flexDirection: 'row',
    ...SHADOWS.medium,
  },
  primaryBtnDisabled: { opacity: 0.6, backgroundColor: COLORS.muted },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
