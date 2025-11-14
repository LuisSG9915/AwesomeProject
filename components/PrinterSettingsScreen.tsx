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
import BluetoothPrinterService, {
  PrinterDevice,
} from '../services/BluetoothPrinterService';
import { COLORS } from '../theme/theme';

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
          <Text style={styles.cardTitle}>Estado</Text>
          <View
            style={[
              styles.statusBadge,
              isConnected ? styles.statusConnected : styles.statusDisconnected,
            ]}
          >
            <Text style={styles.statusText}>
              {isConnected ? '✅ Conectada' : '❌ Desconectada'}
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
                    <Text style={styles.testButtonText}>🖨️ Probar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.disconnectButton}
                    onPress={handleDisconnect}
                  >
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
                    <Text style={styles.connectButtonText}>Reconectar</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {currentPrinter && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClearSaved}
              >
                <Text style={styles.clearButtonText}>
                  🗑️ Eliminar Impresora
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {!currentPrinter && (
          <Text style={styles.noPrinter}>
            No hay impresora configurada. Escanea para encontrar impresoras
            disponibles.
          </Text>
        )}
      </View>

      {/* Buscar Impresoras */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Buscar Impresoras Bluetooth</Text>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={handleScan}
          disabled={scanning}
        >
          {scanning ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.scanButtonText}>🔍 Escanear Dispositivos</Text>
          )}
        </TouchableOpacity>

        {scanning && (
          <Text style={styles.scanningText}>Buscando impresoras...</Text>
        )}

        {/* Lista de Impresoras */}
        {printers.length > 0 && (
          <View style={styles.printersList}>
            <Text style={styles.listTitle}>
              Impresoras Encontradas ({printers.length})
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
                  <View style={styles.printerItemContent}>
                    <Text style={styles.printerItemName}>🖨️ {item.name}</Text>
                    <Text style={styles.printerItemAddress}>
                      {item.address}
                    </Text>
                  </View>
                  {currentPrinter?.address === item.address && isConnected && (
                    <View style={styles.connectedBadge}>
                      <Text style={styles.connectedBadgeText}>Conectada</Text>
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
        <Text style={styles.infoTitle}>ℹ️ Información</Text>
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
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: COLORS.textPrimary,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
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
    fontSize: 14,
  },
  printerInfo: {
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 8,
  },
  printerLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  printerName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  printerAddress: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  testButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  disconnectButton: {
    flex: 1,
    backgroundColor: COLORS.error,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  disconnectButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  connectButton: {
    backgroundColor: COLORS.success,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  connectButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#FF5722',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  noPrinter: {
    color: COLORS.muted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  scanButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  scanningText: {
    textAlign: 'center',
    color: COLORS.primary,
    marginTop: 12,
    fontStyle: 'italic',
  },
  printersList: {
    marginTop: 16,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  printerItem: {
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  printerItemContent: {
    flex: 1,
  },
  printerItemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  printerItemAddress: {
    fontSize: 12,
    color: COLORS.muted,
  },
  connectedBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  connectedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.primaryDark,
    marginBottom: 4,
  },
});
