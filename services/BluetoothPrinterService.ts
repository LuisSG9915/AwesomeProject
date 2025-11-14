import { Platform, PermissionsAndroid, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BluetoothManager,
  BluetoothEscposPrinter,
} from 'react-native-bluetooth-escpos-printer';

export interface PrinterDevice {
  name: string;
  address: string;
}

export interface PrinterStatus {
  connected: boolean;
  printer?: PrinterDevice;
}

const STORAGE_KEY = '@awesomeapp/selected_printer';

class BluetoothPrinterService {
  private currentPrinter: PrinterDevice | null = null;
  private isConnected: boolean = false;

  /**
   * Solicita permisos de Bluetooth en Android
   */
  async requestBluetoothPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 31) {
          // Android 12+
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ]);

          return (
            granted['android.permission.BLUETOOTH_SCAN'] === 'granted' &&
            granted['android.permission.BLUETOOTH_CONNECT'] === 'granted'
          );
        } else {
          // Android < 12
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          );
          return granted === 'granted';
        }
      } catch (err) {
        console.error('Error requesting Bluetooth permissions:', err);
        return false;
      }
    }
    return true; // iOS no necesita permisos explícitos
  }

  /**
   * Habilita Bluetooth
   */
  async enableBluetooth(): Promise<boolean> {
    try {
      const enabled = await BluetoothManager.isBluetoothEnabled();
      if (!enabled) {
        await BluetoothManager.enableBluetooth();
      }
      return true;
    } catch (error) {
      console.error('Error enabling Bluetooth:', error);
      return false;
    }
  }

  /**
   * Escanea impresoras Bluetooth disponibles
   */
  async scanPrinters(): Promise<PrinterDevice[]> {
    try {
      const hasPermissions = await this.requestBluetoothPermissions();
      if (!hasPermissions) {
        Alert.alert(
          'Permisos Necesarios',
          'Se requieren permisos de Bluetooth para buscar impresoras',
        );
        return [];
      }

      const isEnabled = await this.enableBluetooth();
      if (!isEnabled) {
        Alert.alert('Bluetooth', 'Por favor activa el Bluetooth');
        return [];
      }

      const devices = await BluetoothManager.scanDevices();

      // La librería suele devolver un string JSON con { paired: [], found: [] }
      // pero en algunas versiones puede devolver directamente un objeto/array.
      let parsed: any;
      try {
        parsed = typeof devices === 'string' ? JSON.parse(devices) : devices;
      } catch (parseError) {
        console.warn('No se pudo parsear respuesta de scanDevices:', parseError);
        parsed = devices;
      }

      let deviceList: any[] = [];
      if (Array.isArray(parsed)) {
        deviceList = parsed;
      } else if (parsed && (parsed.found || parsed.paired)) {
        deviceList = [
          ...(parsed.found || []),
          ...(parsed.paired || []),
        ];
      }

      // Asegurar dispositivos únicos por address
      const uniqueByAddress = new Map<string, any>();
      deviceList.forEach((device: any) => {
        if (device?.address && !uniqueByAddress.has(device.address)) {
          uniqueByAddress.set(device.address, device);
        }
      });

      const printers: PrinterDevice[] = Array.from(uniqueByAddress.values())
        .filter((device: any) => {
          if (!device.address) return false;
          const name = (device.name || '').toString().toUpperCase();
          // Si no tiene nombre, igual lo mostramos (genéricas)
          if (!name) return true;
          // Nombres comunes de impresoras térmicas
          return (
            name.includes('PRINTER') ||
            name.includes('THERMAL') ||
            name.includes('POS') ||
            name.includes('RP') ||
            name.includes('BT')
          );
        })
        .map((device: any) => ({
          name: device.name || 'Dispositivo sin nombre',
          address: device.address,
        }));

      return printers;
    } catch (error) {
      console.error('Error scanning printers:', error);
      Alert.alert('Error', 'No se pudo escanear impresoras Bluetooth');
      return [];
    }
  }

  /**
   * Conecta a una impresora específica
   */
  async connectToPrinter(printer: PrinterDevice): Promise<boolean> {
    try {
      await BluetoothManager.connect(printer.address);
      this.currentPrinter = printer;
      this.isConnected = true;

      // Guardar impresora seleccionada
      await this.savePrinter(printer);

      return true;
    } catch (error) {
      console.error('Error connecting to printer:', error);
      this.isConnected = false;
      Alert.alert('Error', `No se pudo conectar a la impresora ${printer.name}`);
      return false;
    }
  }

  /**
   * Desconecta de la impresora actual
   */
  async disconnect(): Promise<void> {
    try {
      if (this.isConnected && this.currentPrinter) {
        await BluetoothManager.disconnect();
        this.isConnected = false;
      }
    } catch (error) {
      console.error('Error disconnecting printer:', error);
    }
  }

  /**
   * Guarda la impresora seleccionada en AsyncStorage
   */
  private async savePrinter(printer: PrinterDevice): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(printer));
    } catch (error) {
      console.error('Error saving printer:', error);
    }
  }

  /**
   * Carga la impresora guardada de AsyncStorage
   */
  async loadSavedPrinter(): Promise<PrinterDevice | null> {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved) as PrinterDevice;
      }
      return null;
    } catch (error) {
      console.error('Error loading saved printer:', error);
      return null;
    }
  }

  /**
   * Conecta automáticamente a la última impresora usada
   */
  async connectToSavedPrinter(): Promise<boolean> {
    const savedPrinter = await this.loadSavedPrinter();
    if (savedPrinter) {
      return await this.connectToPrinter(savedPrinter);
    }
    return false;
  }

  /**
   * Obtiene el estado de la conexión
   */
  getStatus(): PrinterStatus {
    return {
      connected: this.isConnected,
      printer: this.currentPrinter || undefined,
    };
  }

  /**
   * Imprime texto plano
   */
  async printText(text: string): Promise<boolean> {
    if (!this.isConnected) {
      Alert.alert('No Conectado', 'Selecciona una impresora primero');
      return false;
    }

    try {
      await BluetoothEscposPrinter.printerInit();
      await BluetoothEscposPrinter.printText(text + '\n\n\n', {});
      return true;
    } catch (error) {
      console.error('Error printing:', error);
      Alert.alert('Error de Impresión', 'No se pudo imprimir el ticket');
      return false;
    }
  }

  /**
   * Imprime líneas de ticket con formato
   */
  async printTicket(lines: string[]): Promise<boolean> {
    if (!this.isConnected) {
      Alert.alert('No Conectado', 'Selecciona una impresora primero');
      return false;
    }

    try {
      await BluetoothEscposPrinter.printerInit();

      for (const line of lines) {
        // Detectar líneas especiales y aplicar formato
        if (line.includes('===') || line.includes('---')) {
          // Separadores
          await BluetoothEscposPrinter.printText(line + '\n', {});
        } else if (
          line.toUpperCase().includes('TICKET') ||
          line.toUpperCase().includes('PRECORTE') ||
          line.toUpperCase().includes('COMPROBANTE')
        ) {
          // Título centrado y en negritas
          await BluetoothEscposPrinter.printText(line + '\n', {
            align: 'center',
            widthtimes: 1,
          });
        } else if (line.toUpperCase().includes('TOTAL')) {
          // Total en negritas
          await BluetoothEscposPrinter.printText(line + '\n', {
            widthtimes: 1,
          });
        } else {
          // Texto normal
          await BluetoothEscposPrinter.printText(line + '\n', {});
        }
      }

      // Alimentación adicional
      await BluetoothEscposPrinter.printText('\n\n\n', {});

      return true;
    } catch (error) {
      console.error('Error printing ticket:', error);
      Alert.alert('Error de Impresión', 'No se pudo imprimir el ticket');
      return false;
    }
  }

  /**
   * Imprime un ticket con encabezado formateado
   */
  async printFormattedTicket(
    businessName: string,
    title: string,
    lines: string[],
  ): Promise<boolean> {
    if (!this.isConnected) {
      Alert.alert('No Conectado', 'Selecciona una impresora primero');
      return false;
    }

    try {
      await BluetoothEscposPrinter.printerInit();

      // Encabezado
      await BluetoothEscposPrinter.printText('================================\n', {});
      await BluetoothEscposPrinter.printText(businessName + '\n', {
        align: 'center',
        widthtimes: 1,
      });
      await BluetoothEscposPrinter.printText('================================\n', {});
      await BluetoothEscposPrinter.printText(title + '\n', {
        align: 'center',
      });
      await BluetoothEscposPrinter.printText('================================\n', {});

      // Contenido
      for (const line of lines) {
        await BluetoothEscposPrinter.printText(line + '\n', {});
      }

      // Pie
      await BluetoothEscposPrinter.printText('================================\n', {});
      await BluetoothEscposPrinter.printText('¡GRACIAS POR SU COMPRA!\n', {
        align: 'center',
      });
      await BluetoothEscposPrinter.printText('================================\n', {});
      await BluetoothEscposPrinter.printText('\n\n\n', {});

      return true;
    } catch (error) {
      console.error('Error printing formatted ticket:', error);
      Alert.alert('Error de Impresión', 'No se pudo imprimir el ticket');
      return false;
    }
  }

  /**
   * Prueba de impresión
   */
  async printTest(): Promise<boolean> {
    if (!this.isConnected) {
      Alert.alert('No Conectado', 'Selecciona una impresora primero');
      return false;
    }

    try {
      const testLines = [
        '================================',
        '        PRUEBA DE IMPRESIÓN',
        '================================',
        `Fecha: ${new Date().toLocaleString('es-MX')}`,
        `Impresora: ${this.currentPrinter?.name}`,
        '================================',
        'Si puede leer esto correctamente,',
        'la impresora está funcionando.',
        '================================',
      ];

      return await this.printTicket(testLines);
    } catch (error) {
      console.error('Error printing test:', error);
      return false;
    }
  }

  /**
   * Limpia la impresora guardada
   */
  async clearSavedPrinter(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      this.currentPrinter = null;
      this.isConnected = false;
    } catch (error) {
      console.error('Error clearing saved printer:', error);
    }
  }
}

export default new BluetoothPrinterService();
