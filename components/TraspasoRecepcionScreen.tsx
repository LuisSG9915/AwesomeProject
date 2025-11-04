import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Modal, ScrollView, Alert } from 'react-native';

type Sucursal = { id_sucursal: number; nombre: string; grupo: number };

type Traspaso = {
  id: number;
  fecha: string;
  sucursalOrigen: string;
  sucursalDestino: number;
  traspaso_responsable_nombre_unique: string;
  folio: number;
  estatus: string;
};

type TraspasoDetalle = { descripcion: string; cantidad: number };

export default function TraspasoRecepcionScreen() {
  const [formFiltro, setFormFiltro] = useState({ fecha1: '', fecha2: '', sucursal: 0 });
  const [sucursales] = useState<Sucursal[]>([
    { id_sucursal: 1, nombre: 'Sucursal Centro', grupo: 1 },
    { id_sucursal: 2, nombre: 'Sucursal Norte', grupo: 1 },
    { id_sucursal: 3, nombre: 'Sucursal Sur', grupo: 2 },
  ]);

  const [traspasos, setTraspasos] = useState<Traspaso[]>([
    { id: 1, fecha: new Date().toISOString(), sucursalOrigen: 'Ruta 1', sucursalDestino: 1, traspaso_responsable_nombre_unique: 'Juan Pérez', folio: 1234, estatus: 'Pendiente' },
    { id: 2, fecha: new Date().toISOString(), sucursalOrigen: 'Ruta 2', sucursalDestino: 2, traspaso_responsable_nombre_unique: 'María López', folio: 2345, estatus: 'Pendiente' },
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

  const filteredTraspasos = useMemo(() => {
    return traspasos.filter(t => (formFiltro.sucursal ? t.sucursalDestino === formFiltro.sucursal : true));
  }, [traspasos, formFiltro]);

  const onConsultar = () => {
    Alert.alert('Búsqueda', `Del: ${formFiltro.fecha1 || '-'}\nAl: ${formFiltro.fecha2 || '-'}\nSucursal: ${formFiltro.sucursal || '-'}`);
  };

  const onRecibir = () => {
    if (!selected) return;
    Alert.alert('Confirmación', '¿Está seguro de recibir este traspaso?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sí, recibir',
        onPress: () => {
          setTraspasos(prev => prev.map(t => (t.id === selected.id ? { ...t, estatus: 'Finalizado' } : t)));
          setModalOpen(false);
          Alert.alert('Recibido', 'El traspaso ha sido recibido correctamente');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Búsqueda de Traspasos</Text>

      <View style={styles.card}>
        <Text style={styles.formLabel}>Vendedor</Text>
        <TextInput value={'Usuario Actual'} editable={false} style={styles.input} />

        <Text style={[styles.formLabel, { marginTop: 8 }]}>Filtros</Text>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.smallLabel}>Fecha inicial</Text>
            <TextInput placeholder="YYYY-MM-DD" value={formFiltro.fecha1} onChangeText={t => setFormFiltro({ ...formFiltro, fecha1: t })} style={styles.input} />
          </View>
          <View style={styles.col}>
            <Text style={styles.smallLabel}>Fecha final</Text>
            <TextInput placeholder="YYYY-MM-DD" value={formFiltro.fecha2} onChangeText={t => setFormFiltro({ ...formFiltro, fecha2: t })} style={styles.input} />
          </View>
        </View>
        <Text style={styles.smallLabel}>Sucursal destino</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={styles.rowWrap}>
            <TouchableOpacity style={[styles.pill, formFiltro.sucursal === 0 && styles.pillOn]} onPress={() => setFormFiltro({ ...formFiltro, sucursal: 0 })}><Text style={[styles.pillText, formFiltro.sucursal === 0 && styles.pillTextOn]}>Todas</Text></TouchableOpacity>
            {sucursales.map(s => (
              <TouchableOpacity key={s.id_sucursal} style={[styles.pill, formFiltro.sucursal === s.id_sucursal && styles.pillOn]} onPress={() => setFormFiltro({ ...formFiltro, sucursal: s.id_sucursal })}>
                <Text style={[styles.pillText, formFiltro.sucursal === s.id_sucursal && styles.pillTextOn]}>{s.nombre}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onConsultar}><Text style={styles.secondaryBtnText}>Consultar</Text></TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Resultados</Text>
        {filteredTraspasos.length === 0 ? (
          <Text style={styles.muted}>Sin resultados</Text>
        ) : (
          <FlatList
            data={filteredTraspasos}
            keyExtractor={i => String(i.id)}
            renderItem={({ item }) => (
              <View style={styles.rowItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invTitle}>Folio {item.folio}</Text>
                  <Text style={styles.muted}>{item.fecha.split('T')[0]} • Origen: {item.sucursalOrigen}</Text>
                </View>
                <Text style={[styles.status, item.estatus === 'Pendiente' ? styles.statusPending : styles.statusDone]}>{item.estatus}</Text>
                <TouchableOpacity style={styles.smallBtn} onPress={() => { setSelected(item); setModalOpen(true); }}>
                  <Text style={styles.smallBtnText}>Ir al traspaso</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>

      <Modal visible={modalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Visor de Traspaso</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}><Text style={styles.link}>Cerrar</Text></TouchableOpacity>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.folio}>FOLIO: {selected?.folio}</Text>
              <Text style={styles.statusInline}>ESTATUS: {selected?.estatus}</Text>
            </View>
            <Text style={styles.muted}>Sucursal destino: {selected ? sucursales.find(s => s.id_sucursal === selected.sucursalDestino)?.nombre : '-'}</Text>
            <Text style={styles.muted}>Ruta origen: {selected?.sucursalOrigen}</Text>

            <View style={[styles.card, { marginTop: 12 }] }>
              <Text style={styles.cardTitle}>Productos</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 2 }]}>Producto</Text>
                <Text style={styles.th}>Cantidad</Text>
              </View>
              <FlatList
                data={selected ? (detalles[selected.id] || []) : []}
                keyExtractor={(_, idx) => String(idx)}
                renderItem={({ item }) => (
                  <View style={styles.tr}>
                    <Text style={[styles.td, { flex: 2 }]}>{item.descripcion}</Text>
                    <Text style={styles.tdCenter}>{item.cantidad}</Text>
                  </View>
                )}
                ListEmptyComponent={<Text style={styles.muted}>Sin productos</Text>}
                style={{ maxHeight: 260 }}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, (selected?.estatus === 'Finalizado' || selected?.estatus === 'Cancelado') && styles.primaryBtnDisabled]}
              onPress={onRecibir}
              disabled={selected?.estatus === 'Finalizado' || selected?.estatus === 'Cancelado'}
            >
              <Text style={styles.primaryBtnText}>OK, RECIBO</Text>
            </TouchableOpacity>
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
  smallLabel: { color: '#666', marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },
  rowWrap: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  pill: { borderWidth: 1, borderColor: '#bbb', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, marginRight: 8 },
  pillOn: { backgroundColor: '#1976D2', borderColor: '#1976D2' },
  pillText: { color: '#333' },
  pillTextOn: { color: '#fff', fontWeight: '600' },
  secondaryBtn: { backgroundColor: '#e0e0e0', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  secondaryBtnText: { color: '#222', fontWeight: '700' },
  cardTitle: { fontWeight: '600', fontSize: 16, marginBottom: 8 },
  muted: { color: '#666' },
  rowItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  invTitle: { fontWeight: '600' },
  status: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 },
  statusPending: { backgroundColor: '#FFF3CD', color: '#333' },
  statusDone: { backgroundColor: '#C8E6C9', color: '#333' },
  smallBtn: { backgroundColor: '#1976D2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  smallBtnText: { color: '#fff', fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '85%', padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  link: { color: '#1976D2', fontWeight: '600' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  folio: { fontWeight: '700', color: '#d32f2f' },
  statusInline: { fontWeight: '600' },
  tableHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  th: { flex: 1, fontWeight: '700' },
  tr: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  td: { flex: 1 },
  tdCenter: { flex: 1, textAlign: 'center' },
  primaryBtn: { backgroundColor: '#1976D2', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
});
