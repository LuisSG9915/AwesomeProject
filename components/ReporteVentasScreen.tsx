import React, { useMemo, useState, useEffect } from 'react';
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
import TicketPrinter from '../services/TicketPrinter';
import FullSyncService from '../services/FullSyncService';
import FacturaService, { FacturaItem } from '../services/FacturaService';
import AuthService from '../services/AuthService';
import {
  COLORS,
  SPACING,
  SHADOWS,
  BORDER_RADIUS,
  TYPOGRAPHY,
} from '../theme/theme';

type ReporteItem = {
  id: number;
  idMovil?: number | null;
  no_venta: number;
  fecha: string;
  nombre: string;
  importe: number;
  tipoPago: 'Efectivo' | 'Credito' | 'Transferencia';
  facturacion?: boolean;
  timbrado?: '0' | '1';
  folioFactura?: boolean;
  facturacionMovil?: boolean;
  sucursal?: number;
  caja?: number;
  cve_cliente?: number;
  nombreProducto?: string;
  cantProducto?: number;
  precio?: number;
};

type GroupedSale = {
  idMovil: number;
  no_venta: number;
  fecha: string;
  nombre: string;
  totalImporte: number;
  tipoPago: 'Efectivo' | 'Credito' | 'Transferencia';
  sucursal?: number;
  cve_cliente?: number;
  productos: Array<{
    nombreProducto: string;
    cantProducto: number;
    precio: number;
    importe: number;
  }>;
};

type TicketLine = string;

export default function ReporteVentasScreen() {
  const today = useMemo(() => new Date(), []);
  const LOCAL_SALE_ID_THRESHOLD = 1700000000000;

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
  const [isLocalView, setIsLocalView] = useState(false);
  const [groupedItems, setGroupedItems] = useState<GroupedSale[]>([]);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const total = useMemo(
    () => items.reduce((s, i) => s + i.importe, 0),
    [items],
  );
  const totalEfectivo = useMemo(
    () =>
      items
        .filter(i => i.tipoPago === 'Efectivo')
        .reduce((s, i) => s + i.importe, 0),
    [items],
  );
  const totalCredito = useMemo(
    () =>
      items
        .filter(i => i.tipoPago === 'Credito')
        .reduce((s, i) => s + i.importe, 0),
    [items],
  );

  useEffect(() => {
    loadVentas();
  }, []);

  const loadVentas = async () => {
    try {
      setDebugInfo('Inicializando FullSyncService...');
      await FullSyncService.initialize();

      // Obtener sucursal del usuario actual
      const currentUser = AuthService.currentUser;
      const sucursalUsuario = currentUser?.sucursal_origen;

      setDebugInfo('Obteniendo ventas por sucursal...');
      let ventas;
      if (sucursalUsuario !== undefined) {
        ventas = FullSyncService.getVentasBySucursal(sucursalUsuario, 10000);
        setDebugInfo(
          `Ventas cargadas para sucursal ${sucursalUsuario}: ${
            ventas?.length || 0
          }`,
        );
      } else {
        ventas = FullSyncService.getVentas(1000);
        setDebugInfo(
          `Ventas cargadas (todas las sucursales): ${ventas?.length || 0}`,
        );
      }

      setAllVentas(ventas);
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('Error al cargar ventas:', error);
      setDebugInfo(`Error al cargar: ${errorMsg}`);
      Alert.alert(
        'Error',
        `No se pudieron cargar las ventas de la base local.\n\nDetalle: ${errorMsg}`,
      );
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

  const mapTipoPago = (
    tipo: number | undefined,
  ): 'Efectivo' | 'Credito' | 'Transferencia' => {
    if (tipo === 1) return 'Efectivo';
    if (tipo === 2) return 'Transferencia';
    if (tipo === 3) return 'Credito';
    return 'Efectivo';
  };

  const filtrarVentas = (soloLocales: boolean) => {
    console.log('Filtrando ventas, soloLocales:', soloLocales);
    setLoading(true);
    setIsLocalView(soloLocales);
    try {
      if (!allVentas || allVentas.length === 0) {
        Alert.alert(
          'Sin datos',
          'No hay ventas cargadas. Intenta sincronizar primero.',
        );
        setLoading(false);
        return;
      }

      if (!fecha1 || !fecha2) {
        Alert.alert('Error', 'Selecciona ambas fechas');
        setLoading(false);
        return;
      }

      // Obtener sucursal del usuario actual
      const currentUser = AuthService.currentUser;
      const sucursalUsuario = currentUser?.sucursal_origen;

      // Crear copias para no mutar los estados y normalizar rango a día completo
      const fecha1Parsed = new Date(fecha1);
      fecha1Parsed.setHours(0, 0, 0, 0);
      const fecha2Parsed = new Date(fecha2);
      fecha2Parsed.setHours(23, 59, 59, 999);

      console.log('[Reporte] Filtering ventas', {
        soloLocales,
        fecha1Parsed,
        fecha2Parsed,
        totalVentas: allVentas.length,
        sucursalUsuario,
      });
      const filtered = allVentas.filter(venta => {
        if (!venta.fecha) return false;
        const ventaDate = new Date(venta.fecha);
        // Filtrar por fecha siempre
        const inDateRange =
          ventaDate >= fecha1Parsed && ventaDate <= fecha2Parsed;

        // Filtrar por sucursal del usuario (si está definida)
        const inSucursal =
          sucursalUsuario === undefined || venta.sucursal === sucursalUsuario;

        if (soloLocales) {
          // Consultar Local: solo ventas con id >= threshold (ventas locales)
          return (
            inDateRange &&
            inSucursal &&
            venta.id &&
            venta.id >= LOCAL_SALE_ID_THRESHOLD
          );
        } else {
          // Consultar: solo ventas con id < threshold (ventas remotas/API)
          return (
            inDateRange &&
            inSucursal &&
            (!venta.id || venta.id < LOCAL_SALE_ID_THRESHOLD)
          );
        }
      });

      console.log('[Reporte] Filtered results', { count: filtered.length });

      const mapped: ReporteItem[] = filtered.map(venta => ({
        id: venta.id,
        idMovil: venta.idMovil,
        no_venta: venta.noVenta || 0,
        fecha: venta.fecha
          ? new Date(venta.fecha).toISOString()
          : new Date().toISOString(),
        nombre: venta.nombreCliente || 'Sin nombre',
        importe: venta.importe || 0,
        tipoPago: mapTipoPago(venta.tipoPago),
        facturacion: !!venta.facturacionMovil,
        timbrado: venta.folioFactura ? '1' : '0',
        folioFactura: !!venta.folioFactura,
        facturacionMovil: !!venta.facturacionMovil,
        sucursal: venta.sucursal,
        cve_cliente: venta.cveCliente,
        nombreProducto: venta.nombreProducto,
        cantProducto: venta.cantProducto,
        precio: venta.precio,
      }));

      setItems(mapped);

      // Si es vista local, agrupar por idMovil
      if (soloLocales) {
        const groupedMap = new Map<number, GroupedSale>();

        filtered.forEach(venta => {
          const idMovil = venta.idMovil || venta.id;
          if (!groupedMap.has(idMovil)) {
            groupedMap.set(idMovil, {
              idMovil,
              no_venta: venta.noVenta || idMovil,
              fecha: venta.fecha
                ? new Date(venta.fecha).toISOString()
                : new Date().toISOString(),
              nombre: venta.nombreCliente || 'Sin nombre',
              totalImporte: 0,
              tipoPago: mapTipoPago(venta.tipoPago),
              sucursal: venta.sucursal,
              cve_cliente: venta.cveCliente,
              productos: [],
            });
          }

          const group = groupedMap.get(idMovil)!;
          const productoImporte = venta.importe || 0;
          group.totalImporte += productoImporte;
          group.productos.push({
            nombreProducto: venta.nombreProducto || 'Sin nombre',
            cantProducto: venta.cantProducto || 0,
            precio: venta.precio || 0,
            importe: productoImporte,
          });
        });

        setGroupedItems(Array.from(groupedMap.values()));
      } else {
        setGroupedItems([]);
      }
    } catch (error: any) {
      console.error('Error al filtrar ventas:', error);
      const errorMsg = error?.message || String(error) || 'Error desconocido';
      const errorStack = error?.stack || '';
      setDebugInfo(
        `Error filtrado: ${errorMsg}\nStack: ${errorStack.substring(0, 200)}`,
      );
      Alert.alert(
        'Error al consultar',
        `No se pudieron filtrar las ventas: ${errorMsg}\n\nVentas disponibles: ${
          allVentas?.length || 0
        }\nThreshold: ${LOCAL_SALE_ID_THRESHOLD}\n\nIntenta sincronizar de nuevo desde el menú principal.`,
      );
    } finally {
      setLoading(false);
    }
  };

  const consultar = () => filtrarVentas(false);

  const consultarLocal = () => filtrarVentas(true);

  const APP_NAME = 'FRESKY HIELO';

  const generateTicket = (row: ReporteItem): TicketLine[] => {
    const lines: string[] = [];
    const width = 32;
    const separator = (char = '=') => char.repeat(width);
    const center = (text: string) => {
      const pad = Math.max(0, Math.floor((width - text.length) / 2));
      return ' '.repeat(pad) + text;
    };
    const leftRight = (left: string, right: string) => {
      const space = Math.max(1, width - left.length - right.length);
      return left + ' '.repeat(space) + right;
    };

    // Encabezado
    lines.push(separator());
    lines.push(center(APP_NAME));
    lines.push(center('Productores de hielo y agua'));
    lines.push(center('purificados del golfo'));
    lines.push(center('RFC: PHA030403QX9'));
    lines.push(center('TEL 01 279 8 34 21 10'));
    lines.push(separator('-'));

    // Datos generales
    lines.push(`Fecha: ${new Date(row.fecha).toLocaleString('es-MX')}`);
    if (row.sucursal) lines.push(`Sucursal: ${row.sucursal}`);
    lines.push(`Cliente: ${row.nombre}`);
    lines.push(`Id Venta: ${row.no_venta}`);
    lines.push(separator('-'));

    // Encabezado de productos
    lines.push('CANT  DESC       PRECIO  IMPORTE');

    // Producto
    if (row.nombreProducto) {
      const cant = String(row.cantProducto || 1)
        .padEnd(4)
        .substring(0, 4);
      const desc = (row.nombreProducto || '').substring(0, 10).padEnd(10);
      const precio = `$${(row.precio || 0).toFixed(2)}`
        .padStart(7)
        .substring(0, 7);
      const importe = `$${row.importe.toFixed(2)}`.padStart(8).substring(0, 8);
      lines.push(`${cant}  ${desc}${precio} ${importe}`);
    }

    lines.push(separator('-'));

    // Forma de pago y total
    lines.push(center('FORMA DE PAGO'));
    lines.push(
      leftRight(row.tipoPago.toUpperCase(), `$${row.importe.toFixed(2)}`),
    );
    lines.push(separator());
    lines.push(center('GRACIAS POR SU COMPRA'));
    lines.push(separator());

    return lines;
  };

  const generateGroupedTicket = (group: GroupedSale): TicketLine[] => {
    const lines: string[] = [];
    const width = 32;
    const separator = (char = '=') => char.repeat(width);
    const center = (text: string) => {
      const pad = Math.max(0, Math.floor((width - text.length) / 2));
      return ' '.repeat(pad) + text;
    };
    const leftRight = (left: string, right: string) => {
      const space = Math.max(1, width - left.length - right.length);
      return left + ' '.repeat(space) + right;
    };

    // Encabezado
    lines.push(separator());
    lines.push(center(APP_NAME));
    lines.push(center('Productores de hielo y agua'));
    lines.push(center('purificados del golfo'));
    lines.push(center('RFC: PHA030403QX9'));
    lines.push(center('TEL 01 279 8 34 21 10'));
    lines.push(separator('-'));

    // Datos generales
    lines.push(`Fecha: ${new Date(group.fecha).toLocaleString('es-MX')}`);
    if (group.sucursal) lines.push(`Sucursal: ${group.sucursal}`);
    lines.push(`Cliente: ${group.nombre}`);
    lines.push(`Id Venta: ${group.no_venta}`);
    lines.push(separator('-'));

    // Encabezado de productos
    lines.push('CANT  DESC       PRECIO  IMPORTE');

    // Productos agrupados
    group.productos.forEach(prod => {
      const cant = String(prod.cantProducto || 1)
        .padEnd(4)
        .substring(0, 4);
      const desc = (prod.nombreProducto || '').substring(0, 10).padEnd(10);
      const precio = `$${(prod.precio || 0).toFixed(2)}`
        .padStart(7)
        .substring(0, 7);
      const importe = `$${prod.importe.toFixed(2)}`.padStart(8).substring(0, 8);
      lines.push(`${cant}  ${desc}${precio} ${importe}`);
    });

    lines.push(separator('-'));

    // Forma de pago y total
    lines.push(center('FORMA DE PAGO'));
    lines.push(
      leftRight(
        group.tipoPago.toUpperCase(),
        `$${group.totalImporte.toFixed(2)}`,
      ),
    );
    lines.push(separator());
    lines.push(center('GRACIAS POR SU COMPRA'));
    lines.push(separator());

    return lines;
  };

  const visualizarGroupedTicket = (group: GroupedSale) => {
    setTicketContent(generateGroupedTicket(group));
    setTicketVisible(true);
  };

  const imprimirGroupedTicket = async (group: GroupedSale) => {
    const lines = generateGroupedTicket(group);
    await TicketPrinter.print(lines, 'Ticket de Venta');
  };

  const visualizarTicket = (row: ReporteItem) => {
    setTicketContent(generateTicket(row));
    setTicketVisible(true);
  };

  const imprimirTicket = async (row: ReporteItem) => {
    const lines = generateTicket(row);
    await TicketPrinter.print(lines, 'Ticket de Venta');
  };

  const facturarVenta = async (row: ReporteItem) => {
    try {
      // Si ya tiene folio/timbrado, reimprimir CFDI
      if (row.folioFactura || row.timbrado === '1') {
        if (!row.no_venta || !row.sucursal) {
          Alert.alert(
            'Factura',
            'No hay información suficiente para reimprimir',
          );
          return;
        }

        await FacturaService.getInstance().imprimirFacturaExistente(
          row.no_venta,
          row.sucursal,
          row.caja || 2,
          () => loadVentas(),
        );
        return;
      }

      // Si está marcada para facturación móvil, generar factura
      if (row.facturacionMovil && row.cve_cliente && row.sucursal) {
        // Confirmación simple (modo de prueba no aplicado aquí de momento)
        const fechaVenta = new Date(row.fecha);
        const yyyy = fechaVenta.getFullYear();
        const mm = String(fechaVenta.getMonth() + 1).padStart(2, '0');
        const dd = String(fechaVenta.getDate()).padStart(2, '0');
        const fechaFactura = `${yyyy}-${mm}-${dd}`;

        const facturaItem: FacturaItem = {
          id: row.no_venta,
          idCliente: row.cve_cliente,
          idGrupo: 0,
          sucursal: row.sucursal,
          caja: row.caja || 1,
          noVenta: row.no_venta,
          formaPago: '03', // Transferencia electrónica
          metodoPago: 'PUE', // Pago en una sola exhibición
          usoCFDI: 'G03', // Gastos en general
        };

        await FacturaService.getInstance().generarFactura(
          [facturaItem],
          fechaFactura,
          () => loadVentas(),
        );
        return;
      }

      Alert.alert('Factura', 'Esta venta no permite factura');
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.message || 'Ocurrió un error al manejar la factura',
      );
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Consulta a Ventas</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadVentas}>
          <Icon name="refresh" type="material" color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      {allVentas.length > 0 && (
        <View style={styles.infoCard}>
          <Icon
            name="info"
            type="material"
            color={COLORS.primary}
            size={20}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.infoText}>
            {allVentas.length} ventas sincronizadas en la base local
          </Text>
        </View>
      )}

      {allVentas.length === 0 && (
        <View style={styles.warningCard}>
          <Icon
            name="warning"
            type="material"
            color={COLORS.warning}
            size={24}
          />
          <Text style={styles.warningText}>
            No hay ventas sincronizadas. Inicia sesión nuevamente o sincroniza
            desde el menú principal.
          </Text>
        </View>
      )}
      {/* 
      {debugInfo && (
        <TouchableOpacity
          style={styles.debugCard}
          onPress={() => Alert.alert('Debug Info', debugInfo)}
        >
          <Icon
            name="bug-report"
            type="material"
            color={COLORS.info}
            size={20}
          />
          <Text style={styles.debugText}>
            Ver información de debug (toca para detalles)
          </Text>
        </TouchableOpacity>
      )} */}

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.formLabel}>Fecha inicial</Text>
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
            <Text style={styles.formLabel}>Fecha final</Text>
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
              />
            )}
          </>
        )}
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={consultar}
          disabled={loading}
        >
          <Text style={styles.secondaryBtnText}>
            {loading ? 'Cargando...' : 'Consultar'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={consultarLocal}
          disabled={loading}
        >
          <Text style={styles.secondaryBtnText}>
            {loading ? 'Cargando...' : 'Consultar local'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Resultados {isLocalView ? '(Ventas Locales)' : '(Ventas Remotas)'}
        </Text>

        {/* Vista agrupada para ventas locales */}
        {isLocalView && groupedItems.length === 0 && (
          <Text style={styles.muted}>Sin resultados</Text>
        )}
        {isLocalView && groupedItems.length > 0 && (
          <FlatList
            data={groupedItems}
            keyExtractor={i => String(i.idMovil)}
            scrollEnabled={false}
            renderItem={({ item: group }) => (
              <View style={styles.groupedItem}>
                <View style={styles.groupHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invTitle}>
                      #{group.no_venta} • {group.nombre}
                    </Text>
                    <Text style={styles.muted}>
                      {new Date(group.fecha).toLocaleString('es-MX')} •{' '}
                      {group.tipoPago}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.money}>
                      ${group.totalImporte.toFixed(2)}
                    </Text>
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        onPress={() => imprimirGroupedTicket(group)}
                        style={styles.iconBtn}
                      >
                        <Icon
                          name="print"
                          type="material"
                          color={COLORS.primary}
                          size={20}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => visualizarGroupedTicket(group)}
                        style={styles.iconBtn}
                      >
                        <Icon
                          name="visibility"
                          type="material"
                          color={COLORS.info}
                          size={20}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                {/* Lista de productos agrupados */}
                <View style={styles.productList}>
                  {group.productos.map((prod, idx) => (
                    <View key={idx} style={styles.productRow}>
                      <Text style={styles.productName}>
                        {prod.cantProducto}x {prod.nombreProducto}
                      </Text>
                      <Text style={styles.productPrice}>
                        ${prod.importe.toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          />
        )}

        {/* Vista normal para ventas remotas */}
        {!isLocalView && items.length === 0 && (
          <Text style={styles.muted}>Sin resultados</Text>
        )}
        {!isLocalView && items.length > 0 && (
          <FlatList
            data={items}
            keyExtractor={i => String(i.id)}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.rowItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invTitle}>
                    #{item.no_venta} • {item.nombre}
                  </Text>
                  <Text style={styles.muted}>
                    {new Date(item.fecha).toLocaleString('es-MX')} •{' '}
                    {item.tipoPago}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.money}>${item.importe.toFixed(2)}</Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      onPress={() => imprimirTicket(item)}
                      style={styles.iconBtn}
                    >
                      <Icon
                        name="print"
                        type="material"
                        color={COLORS.primary}
                        size={20}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => visualizarTicket(item)}
                      style={styles.iconBtn}
                    >
                      <Icon
                        name="visibility"
                        type="material"
                        color={COLORS.info}
                        size={20}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => facturarVenta(item)}
                      disabled
                      style={styles.iconBtn}
                    >
                      <Icon
                        name="receipt"
                        type="material"
                        color={
                          !item.folioFactura && !item.facturacionMovil
                            ? COLORS.muted
                            : COLORS.success
                        }
                        size={20}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          />
        )}

        {items.length > 0 && (
          <View style={styles.totalsBox}>
            <View style={styles.rowBetween}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.moneySmall}>${total.toFixed(2)}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.totalLabel}>Total Efectivo</Text>
              <Text style={styles.moneySmall}>${totalEfectivo.toFixed(2)}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.totalLabel}>Total Créditos</Text>
              <Text style={styles.moneySmall}>${totalCredito.toFixed(2)}</Text>
            </View>
          </View>
        )}
      </View>

      <Modal visible={ticketVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.ticketModalCard}>
            <View style={styles.ticketHeader}>
              <Text style={styles.ticketModalTitle}>
                Vista Previa del Ticket
              </Text>
              <TouchableOpacity onPress={() => setTicketVisible(false)}>
                <Icon
                  name="close"
                  type="material"
                  color={COLORS.textSecondary}
                  size={24}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.ticketPaper}>
              <ScrollView style={{ maxHeight: 400 }}>
                {ticketContent.map((line, idx) => (
                  <Text key={idx} style={styles.ticketLine}>
                    {line}
                  </Text>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.m, paddingBottom: SPACING.xxl },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  title: { ...TYPOGRAPHY.h2 },
  refreshButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.s,
    ...SHADOWS.small,
  },
  infoCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    marginBottom: SPACING.m,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    color: COLORS.primaryDark,
    fontSize: 14,
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
    fontSize: 14,
    fontWeight: '500',
  },
  debugCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    marginBottom: SPACING.m,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.info,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    ...SHADOWS.small,
  },
  debugText: {
    flex: 1,
    color: COLORS.info,
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
  formLabel: { ...TYPOGRAPHY.h3, fontSize: 14, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.m,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    marginTop: 4,
  },
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
    ...SHADOWS.small,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  iosPickerContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.m,
    marginTop: SPACING.s,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iosPickerHeader: {
    backgroundColor: COLORS.background,
    padding: SPACING.m,
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  iosPickerButton: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  iosPicker: {
    width: '100%',
    height: 200,
  },
  secondaryBtn: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.l,
    alignItems: 'center',
    marginTop: SPACING.m,
  },
  secondaryBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 16 },
  cardTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    marginBottom: SPACING.m,
  },
  muted: { color: COLORS.muted, textAlign: 'center', padding: SPACING.m },
  row: { flexDirection: 'row', gap: SPACING.m },
  col: { flex: 1 },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  groupedItem: {
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.m,
    marginBottom: SPACING.s,
    padding: SPACING.m,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productList: {
    marginTop: SPACING.s,
    paddingTop: SPACING.s,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  productName: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  productPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginLeft: SPACING.s,
  },
  invTitle: { fontWeight: '600', color: COLORS.textPrimary, fontSize: 14 },
  money: {
    width: 100,
    textAlign: 'right',
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 8,
  },
  iconBtn: {
    padding: 4,
  },
  totalsBox: {
    backgroundColor: COLORS.background,
    padding: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
    marginTop: SPACING.m,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  totalLabel: { color: COLORS.textSecondary, fontSize: 14 },
  moneySmall: { fontWeight: '600', color: COLORS.textPrimary, fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.l,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.l,
    ...SHADOWS.large,
  },
  modalTitle: { ...TYPOGRAPHY.h3, fontSize: 18 },
  ticketModalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.m,
    ...SHADOWS.large,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
    paddingHorizontal: SPACING.s,
  },
  ticketModalTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  ticketPaper: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ticketLine: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    lineHeight: 15,
    color: '#000000',
  },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.textPrimary,
  },
});
