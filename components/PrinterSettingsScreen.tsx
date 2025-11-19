import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Icon } from 'react-native-elements';
import BluetoothPrinterService, {
  PrinterDevice,
} from '../services/BluetoothPrinterService';
import {
  COLORS,
  SPACING,
  SHADOWS,
  BORDER_RADIUS,
  TYPOGRAPHY,
} from '../theme/theme';

export default function PrinterSettingsScreen() {
  const [printers, setPrinters] = useState<PrinterDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [currentPrinter, setCurrentPrinter] = useState<PrinterDevice | null>(
    null,
  );
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    loadCurrentPrinter();
  }, []);

  const loadCurrentPrinter = async () => {
    const status = BluetoothPrinterService.getStatus();
    setIsConnected(status.connected);
    setCurrentPrinter(status.printer || null);

    if (!status.connected) {
      // Intentar conectar a la última impresora guardada
      const saved = await BluetoothPrinterService.loadSavedPrinter();
      if (saved) {
        setCurrentPrinter(saved);
      }
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setPrinters([]);

    try {
      const devices = await BluetoothPrinterService.scanPrinters();
      setPrinters(devices);

      if (devices.length === 0) {
        Alert.alert(
          'Sin Resultados',
          'No se encontraron impresoras Bluetooth.\n\nAsegúrate de que:\n- El Bluetooth esté activado\n- La impresora esté encendida\n- La impresora esté en modo de emparejamiento',
        );
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo escanear impresoras');
    } finally {
      setScanning(false);
    }
  };

  const handleConnect = async (printer: PrinterDevice) => {
    setConnecting(true);

    try {
      const success = await BluetoothPrinterService.connectToPrinter(printer);

      if (success) {
        setIsConnected(true);
        setCurrentPrinter(printer);
        Alert.alert('✅ Conectado', `Conectado exitosamente a ${printer.name}`);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo conectar a la impresora');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    Alert.alert('Desconectar', '¿Deseas desconectar la impresora actual?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desconectar',
        style: 'destructive',
        onPress: async () => {
          await BluetoothPrinterService.disconnect();
          setIsConnected(false);
          setCurrentPrinter(null);
        },
      },
    ]);
  };

  const handleTestPrint = async () => {
    const success = await BluetoothPrinterService.printTest();
    if (success) {
      Alert.alert('✅ Éxito', 'Ticket de prueba impreso correctamente');
    }
  };

  const handleClearSaved = async () => {
    Alert.alert(
      'Eliminar Impresora',
      '¿Deseas eliminar la impresora guardada?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await BluetoothPrinterService.clearSavedPrinter();
            await BluetoothPrinterService.disconnect();
            setIsConnected(false);
            setCurrentPrinter(null);
            Alert.alert('Eliminada', 'Impresora eliminada correctamente');
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Configuración de Impresora</Text>

      {/* Estado Actual */}
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon
              name="info"
              type="material"
              color={COLORS.primary}
              size={24}
            />
            <Text style={styles.cardTitle}>Estado</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              isConnected ? styles.statusConnected : styles.statusDisconnected,
            ]}
          >
            <Text style={styles.statusText}>
              {isConnected ? 'Conectada' : 'Desconectada'}
            </Text>
          </View>
        </View>

        {currentPrinter && (
          <View style={styles.printerInfo}>
            <Text style={styles.printerLabel}>Impresora Actual:</Text>
            <Text style={styles.printerName}>{currentPrinter.name}</Text>
            <Text style={styles.printerAddress}>{currentPrinter.address}</Text>

            <View style={styles.buttonRow}>
              {isConnected ? (
                <>
                  <TouchableOpacity
                    style={styles.testButton}
                    onPress={handleTestPrint}
                  >
                    <Icon name="print" type="material" color="#fff" size={20} />
                    <Text style={styles.testButtonText}>Probar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.disconnectButton}
                    onPress={handleDisconnect}
                  >
                    <Icon
                      name="bluetooth-disabled"
                      type="material"
                      color="#fff"
                      size={20}
                    />
                    <Text style={styles.disconnectButtonText}>Desconectar</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.connectButton}
                  onPress={() => handleConnect(currentPrinter)}
                  disabled={connecting}
                >
                  {connecting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Icon
                        name="bluetooth-connected"
                        type="material"
                        color="#fff"
                        size={20}
                      />
                      <Text style={styles.connectButtonText}>Reconectar</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {currentPrinter && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClearSaved}
              >
                <Icon name="delete" type="material" color="#fff" size={20} />
                <Text style={styles.clearButtonText}>Eliminar Impresora</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {!currentPrinter && (
          <View style={styles.emptyState}>
            <Icon
              name="print-disabled"
              type="material"
              color={COLORS.muted}
              size={40}
            />
            <Text style={styles.noPrinter}>
              No hay impresora configurada. Escanea para encontrar impresoras
              disponibles.
            </Text>
          </View>
        )}
      </View>

      {/* Buscar Impresoras */}
      <View style={styles.card}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <Icon
            name="bluetooth-searching"
            type="material"
            color={COLORS.primary}
            size={24}
          />
          <Text style={[styles.cardTitle, { marginBottom: 0 }]}>
            Buscar Dispositivos
          </Text>
        </View>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={handleScan}
          disabled={scanning}
        >
          {scanning ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.scanButtonText}>Escanear</Text>
          )}
        </TouchableOpacity>

        {scanning && (
          <Text style={styles.scanningText}>Buscando impresoras...</Text>
        )}

        {/* Lista de Impresoras */}
        {printers.length > 0 && (
          <View style={styles.printersList}>
            <Text style={styles.listTitle}>
              Dispositivos Encontrados ({printers.length})
            </Text>
            <FlatList
              data={printers}
              keyExtractor={item => item.address}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.printerItem}
                  onPress={() => handleConnect(item)}
                  disabled={connecting}
                >
                  <View style={styles.printerItemIcon}>
                    <Icon
                      name="print"
                      type="material"
                      color={COLORS.primary}
                      size={24}
                    />
                  </View>
                  <View style={styles.printerItemContent}>
                    <Text style={styles.printerItemName}>{item.name}</Text>
                    <Text style={styles.printerItemAddress}>
                      {item.address}
                    </Text>
                  </View>
                  {currentPrinter?.address === item.address && isConnected && (
                    <View style={styles.connectedBadge}>
                      <Icon
                        name="check"
                        type="material"
                        color="#fff"
                        size={14}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      {/* Información */}
      <View style={styles.infoCard}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <Icon
            name="help-outline"
            type="material"
            color={COLORS.primary}
            size={20}
          />
          <Text style={styles.infoTitle}>Información</Text>
        </View>
        <Text style={styles.infoText}>
          • La impresora seleccionada se guardará automáticamente
        </Text>
        <Text style={styles.infoText}>
          • No necesitarás seleccionarla nuevamente en futuros usos
        </Text>
        <Text style={styles.infoText}>
          • Usa el botón "Probar" para verificar la conexión
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.m,
  },
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
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  cardTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    marginBottom: SPACING.s,
  },
  statusBadge: {
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.l,
  },
  statusConnected: {
    backgroundColor: COLORS.success,
  },
  statusDisconnected: {
    backgroundColor: COLORS.error,
  },
  statusText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  printerInfo: {
    backgroundColor: COLORS.background,
    padding: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  printerLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  printerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  printerAddress: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: SPACING.m,
    fontFamily: 'monospace',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.s,
    marginBottom: SPACING.s,
  },
  testButton: {
    flex: 1,
    backgroundColor: COLORS.info,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  testButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  disconnectButton: {
    flex: 1,
    backgroundColor: COLORS.error,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  disconnectButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  connectButton: {
    backgroundColor: COLORS.success,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  connectButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: COLORS.muted,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.m,
    alignItems: 'center',
    marginTop: SPACING.s,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.l,
  },
  noPrinter: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.s,
    paddingHorizontal: SPACING.l,
  },
  scanButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.l,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  scanningText: {
    textAlign: 'center',
    color: COLORS.primary,
    marginTop: SPACING.m,
    fontStyle: 'italic',
  },
  printersList: {
    marginTop: SPACING.m,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.s,
  },
  printerItem: {
    backgroundColor: COLORS.background,
    padding: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
    marginBottom: SPACING.s,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  printerItemIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.m,
  },
  printerItemContent: {
    flex: 1,
  },
  printerItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  printerItemAddress: {
    fontSize: 12,
    color: COLORS.muted,
    fontFamily: 'monospace',
  },
  connectedBadge: {
    backgroundColor: COLORS.success,
    width: 24,
    height: 24,
    borderRadius: BORDER_RADIUS.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectedBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: BORDER_RADIUS.l,
    padding: SPACING.m,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.primaryDark,
    marginBottom: 4,
    marginLeft: 28,
  },
});
