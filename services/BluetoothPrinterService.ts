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
        console.warn(
          'No se pudo parsear respuesta de scanDevices:',
          parseError,
        );
        parsed = devices;
      }

      let deviceList: any[] = [];
      if (Array.isArray(parsed)) {
        deviceList = parsed;
      } else if (parsed && (parsed.found || parsed.paired)) {
        deviceList = [...(parsed.found || []), ...(parsed.paired || [])];
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
            name.includes('BT') ||
            name.includes('EC MP')
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
  async connectToPrinter(
    printer: PrinterDevice,
    options?: { silent?: boolean },
  ): Promise<boolean> {
    try {
      const isEnabled = await this.enableBluetooth();
      if (!isEnabled) {
        Alert.alert('Bluetooth', 'Por favor activa el Bluetooth');
        return false;
      }

      // Intentar limpiar cualquier conexión previa que haya quedado colgada
      try {
        await BluetoothManager.disconnect();
      } catch (disconnectError) {
        console.warn(
          'Error intentando resetear la conexión Bluetooth antes de conectar:',
          disconnectError,
        );
      }

      await BluetoothManager.connect(printer.address);
      this.currentPrinter = printer;
      this.isConnected = true;

      // Guardar impresora seleccionada
      await this.savePrinter(printer);

      return true;
    } catch (error: any) {
      console.error('Error connecting to printer:', error);
      this.currentPrinter = null;
      this.isConnected = false;

      if (!options?.silent) {
        const message =
          typeof error?.message === 'string'
            ? `No se pudo conectar a la impresora ${printer.name}.` +
              `\n\nDetalle: ${error.message}`
            : `No se pudo conectar a la impresora ${printer.name}`;

        Alert.alert('Error', message);
      }

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
      return await this.connectToPrinter(savedPrinter, { silent: true });
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
      await BluetoothEscposPrinter.printText(
        '================================\n',
        {},
      );
      await BluetoothEscposPrinter.printText(businessName + '\n', {
        align: 'center',
        widthtimes: 1,
      });
      await BluetoothEscposPrinter.printText(
        '================================\n',
        {},
      );
      await BluetoothEscposPrinter.printText(title + '\n', {
        align: 'center',
      });
      await BluetoothEscposPrinter.printText(
        '================================\n',
        {},
      );

      // Contenido
      for (const line of lines) {
        await BluetoothEscposPrinter.printText(line + '\n', {});
      }

      // Pie
      await BluetoothEscposPrinter.printText(
        '================================\n',
        {},
      );
      await BluetoothEscposPrinter.printText('¡GRACIAS POR SU COMPRA!\n', {
        align: 'center',
      });
      await BluetoothEscposPrinter.printText(
        '================================\n',
        {},
      );
      await BluetoothEscposPrinter.printText('\n\n\n', {});

      return true;
    } catch (error) {
      console.error('Error printing formatted ticket:', error);
      Alert.alert('Error de Impresión', 'No se pudo imprimir el ticket');
      return false;
    }
  }

  /**
   * Imprime un código QR
   */
  async printQR(data: string, size: number = 6): Promise<boolean> {
    if (!this.isConnected) {
      console.warn('No hay impresora conectada para imprimir QR');
      return false;
    }

    try {
      // Centrar el QR
      await BluetoothEscposPrinter.printText('\n', { align: 'center' });

      // Imprimir QR usando el método de la librería
      // size: 1-16 (tamaño del QR), errorLevel: 1=L, 2=M, 3=Q, 4=H
      await BluetoothEscposPrinter.printQRCode(data, size, 3);

      await BluetoothEscposPrinter.printText('\n', {});
      return true;
    } catch (error) {
      console.error('Error printing QR:', error);
      return false;
    }
  }

  /**
   * Imprime un ticket CFDI con formato profesional y QR
   */
  async printCFDITicket(params: {
    serie: string;
    folio: string;
    uuid?: string;
    fecha?: string;
    rfcEmisor?: string;
    rfcReceptor?: string;
    total?: number;
    conceptos?: Array<{
      descripcion: string;
      cantidad: number;
      precio: number;
      importe: number;
    }>;
    qrUrl?: string;
    selloDigital?: string;
  }): Promise<boolean> {
    if (!this.isConnected) {
      Alert.alert('No Conectado', 'Selecciona una impresora primero');
      return false;
    }

    try {
      await BluetoothEscposPrinter.printerInit();
      const w = 32; // ancho de caracteres
      const sep = '='.repeat(w);
      const sepLight = '-'.repeat(w);

      // Función helper para centrar texto
      const center = (text: string) => {
        const pad = Math.max(0, Math.floor((w - text.length) / 2));
        return ' '.repeat(pad) + text;
      };

      // Función helper para alinear izquierda-derecha
      const leftRight = (left: string, right: string) => {
        const space = Math.max(1, w - left.length - right.length);
        return left + ' '.repeat(space) + right;
      };

      // ═══════════════ ENCABEZADO ═══════════════
      await BluetoothEscposPrinter.printText(sep + '\n', {});
      await BluetoothEscposPrinter.printText('FRESKY HIELO\n', {
        align: 'center',
        widthtimes: 1,
      });
      await BluetoothEscposPrinter.printText('Productores de hielo y agua\n', {
        align: 'center',
      });
      await BluetoothEscposPrinter.printText('purificados del golfo\n', {
        align: 'center',
      });
      await BluetoothEscposPrinter.printText('RFC: PHA030403QX9\n', {
        align: 'center',
      });
      await BluetoothEscposPrinter.printText('TEL 01 279 8 34 21 10\n', {
        align: 'center',
      });
      await BluetoothEscposPrinter.printText(sep + '\n', {});

      // ═══════════════ TIPO DOCUMENTO ═══════════════
      await BluetoothEscposPrinter.printText('FACTURA ELECTRONICA CFDI\n', {
        align: 'center',
        widthtimes: 1,
      });
      await BluetoothEscposPrinter.printText(sepLight + '\n', {});

      // ═══════════════ DATOS DE LA FACTURA ═══════════════
      await BluetoothEscposPrinter.printText(
        leftRight('Serie-Folio:', `${params.serie}-${params.folio}`) + '\n',
        {},
      );

      if (params.fecha) {
        await BluetoothEscposPrinter.printText(
          leftRight('Fecha:', params.fecha) + '\n',
          {},
        );
      }

      if (params.uuid) {
        await BluetoothEscposPrinter.printText('UUID:\n', {});
        // UUID puede ser largo, lo imprimimos en líneas de 32 chars
        for (let i = 0; i < params.uuid.length; i += w) {
          await BluetoothEscposPrinter.printText(
            params.uuid.substring(i, i + w) + '\n',
            {},
          );
        }
      }

      if (params.rfcEmisor) {
        await BluetoothEscposPrinter.printText(
          leftRight('RFC Emisor:', params.rfcEmisor) + '\n',
          {},
        );
      }

      if (params.rfcReceptor) {
        await BluetoothEscposPrinter.printText(
          leftRight('RFC Receptor:', params.rfcReceptor) + '\n',
          {},
        );
      }

      await BluetoothEscposPrinter.printText(sepLight + '\n', {});

      // ═══════════════ CONCEPTOS ═══════════════
      if (params.conceptos && params.conceptos.length > 0) {
        await BluetoothEscposPrinter.printText('CONCEPTOS\n', {
          widthtimes: 1,
        });
        await BluetoothEscposPrinter.printText(
          'CANT DESC      PRECIO  IMPORTE\n',
          {},
        );
        await BluetoothEscposPrinter.printText(sepLight + '\n', {});

        for (const c of params.conceptos) {
          const cant = String(c.cantidad).padEnd(4).substring(0, 4);
          const desc = (c.descripcion || '').substring(0, 9).padEnd(9);
          const precio = `$${c.precio.toFixed(0)}`.padStart(7);
          const importe = `$${c.importe.toFixed(2)}`.padStart(9);
          await BluetoothEscposPrinter.printText(
            `${cant} ${desc}${precio}${importe}\n`,
            {},
          );
        }
        await BluetoothEscposPrinter.printText(sepLight + '\n', {});
      }

      // ═══════════════ TOTAL ═══════════════
      if (params.total !== undefined) {
        await BluetoothEscposPrinter.printText(
          leftRight('TOTAL:', `$${params.total.toFixed(2)}`) + '\n',
          { widthtimes: 1 },
        );
        await BluetoothEscposPrinter.printText(sep + '\n', {});
      }

      // ═══════════════ CÓDIGO QR ═══════════════
      if (params.qrUrl) {
        await BluetoothEscposPrinter.printText('\n', {});
        await BluetoothEscposPrinter.printText(
          center('VERIFICACION SAT') + '\n',
          {},
        );
        await BluetoothEscposPrinter.printText(
          center('Escanee el codigo QR') + '\n',
          {},
        );
        await BluetoothEscposPrinter.printText('\n', {});

        // Imprimir QR centrado
        await this.printQR(params.qrUrl, 6);

        await BluetoothEscposPrinter.printText('\n', {});
      }

      // ═══════════════ SELLO DIGITAL (resumido) ═══════════════
      if (params.selloDigital) {
        await BluetoothEscposPrinter.printText(sepLight + '\n', {});
        await BluetoothEscposPrinter.printText('Sello Digital SAT:\n', {});
        // Solo los primeros 64 caracteres
        const selloCorto = params.selloDigital.substring(0, 64) + '...';
        await BluetoothEscposPrinter.printText(selloCorto + '\n', {});
      }

      // ═══════════════ PIE ═══════════════
      await BluetoothEscposPrinter.printText(sep + '\n', {});
      await BluetoothEscposPrinter.printText(
        center('Este documento es una') + '\n',
        {},
      );
      await BluetoothEscposPrinter.printText(
        center('representacion impresa de un CFDI') + '\n',
        {},
      );
      await BluetoothEscposPrinter.printText(sep + '\n', {});
      await BluetoothEscposPrinter.printText('\n\n\n', {});

      return true;
    } catch (error) {
      console.error('Error printing CFDI ticket:', error);
      Alert.alert('Error de Impresión', 'No se pudo imprimir el ticket CFDI');
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
