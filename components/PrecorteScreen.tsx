import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Alert, ScrollView } from 'react-native';
import TicketPrinter from '../services/TicketPrinter';

type PrecorteItem = {
  id: number;
  clave_prod: string;
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
  const [items, setItems] = useState<PrecorteItem[]>([
    { id: 1, clave_prod: 'PROD-001', entradas: 10, salidas: 4, ifValue: 6 },
    { id: 2, clave_prod: 'PROD-002', entradas: 3, salidas: 1, ifValue: 2 },
    { id: 3, clave_prod: 'PROD-003', entradas: 0, salidas: 5, ifValue: -5 },
  ]);
  const [totalEfectivo, setTotalEfectivo] = useState(1234.56);

  const consultar = () => {
    Alert.alert('Consulta', `Fecha: ${fecha}`);
  };

  const imprimir = async () => {
    const lines: string[] = [];
    lines.push('================================');
    lines.push('          PRECORTE');
    lines.push('================================');
    lines.push(`FECHA: ${new Date().toLocaleString()}`);
    lines.push('================================');
    lines.push('PRODUCTO');
    lines.push('ENTRADA      SALIDA     IF');
    lines.push('--------------------------------');
    items.forEach(it => {
      lines.push(it.clave_prod.slice(0, 32));
      const ent = it.entradas.toFixed(1).padStart(8);
      const sal = it.salidas.toFixed(1).padStart(8);
      const inv = it.ifValue.toFixed(1).padStart(8);
      lines.push(`  ${ent} ${sal} ${inv}`);
    });
    lines.push('');
    lines.push(`TOTAL EFECTIVO: $${totalEfectivo.toFixed(2)}`);
    await TicketPrinter.print(lines, 'Precorte');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Precorte</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.formLabel}>Fecha</Text>
        <TextInput value={fecha} onChangeText={setFecha} style={styles.input} placeholder="YYYY-MM-DD" />
        <TouchableOpacity style={styles.secondaryBtn} onPress={consultar}>
          <Text style={styles.secondaryBtnText}>Consultar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Detalle</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 2 }]}>Producto</Text>
          <Text style={styles.th}>Entradas</Text>
          <Text style={styles.th}>Salidas</Text>
          <Text style={styles.th}>IF</Text>
        </View>
        {items.length === 0 ? (
          <Text style={styles.muted}>No hay datos</Text>
        ) : (
          <FlatList
            data={items}
            keyExtractor={i => String(i.id)}
            renderItem={({ item }) => (
              <View style={styles.tr}>
                <Text style={[styles.td, { flex: 2 }]}>{item.clave_prod}</Text>
                <Text style={styles.tdCenter}>{item.entradas.toFixed(2)}</Text>
                <Text style={styles.tdCenter}>{item.salidas.toFixed(2)}</Text>
                <Text style={styles.tdCenter}>{item.ifValue.toFixed(2)}</Text>
              </View>
            )}
          />
        )}

        <View style={styles.footerBox}>
          <Text style={styles.footerText}>Total efectivo: ${totalEfectivo.toFixed(2)}</Text>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={imprimir}>
          <Text style={styles.primaryBtnText}>Imprimir</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 'bold' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  cardTitle: { fontWeight: '600', fontSize: 16, marginBottom: 8 },
  formLabel: { fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  tableHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  th: { flex: 1, fontWeight: '700' },
  tr: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  td: { flex: 1 },
  tdCenter: { flex: 1, textAlign: 'center' },
  muted: { color: '#666', marginTop: 8 },
  footerBox: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#eee' },
  footerText: { fontWeight: '700' },
  primaryBtn: { backgroundColor: '#1976D2', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: { backgroundColor: '#e0e0e0', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  secondaryBtnText: { color: '#222', fontWeight: '700' },
});
