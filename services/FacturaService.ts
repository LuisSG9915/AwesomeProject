import { Alert } from 'react-native';
import BluetoothPrinterService from './BluetoothPrinterService';
import FullSyncService from './FullSyncService';
import { clearWarnings } from 'react-native/types_generated/Libraries/LogBox/Data/LogBoxData';

export interface FacturaItem {
  id: number;
  idCliente: number;
  idGrupo: number;
  sucursal: number;
  caja?: number;
  noVenta: number;
  formaPago: string;
  metodoPago: string;
  usoCFDI: string;
}

class FacturaService {
  private static instance: FacturaService | null = null;

  private apiBaseUrl = 'https://cbinfo.no-ip.info:9004';
  private cppApiBaseUrl = 'https://cbinfo.no-ip.info:9011';

  static getInstance(): FacturaService {
    if (!FacturaService.instance) {
      FacturaService.instance = new FacturaService();
    }
    return FacturaService.instance;
  }

  private constructor() {}

  async generarFactura(
    selectedItems: FacturaItem[],
    fechaFactura: string,
    onSuccess: () => void,
  ): Promise<void> {
    try {
      if (!selectedItems || selectedItems.length === 0) {
        Alert.alert(
          'Error',
          'Debes seleccionar al menos una venta para facturar',
        );
        return;
      }

      if (!fechaFactura) {
        Alert.alert('Error', 'No se puede facturar sin fecha de factura');
        return;
      }

      // En esta app móvil sólo estamos facturando una venta a la vez
      const item = selectedItems[0];

      // Resolver idGrupo desde Realm (equivalente a IndexedDBService.getClientsById)
      await FullSyncService.initialize();
      const cliente = FullSyncService.getClienteFullById
        ? FullSyncService.getClienteFullById(item.idCliente)
        : null;
      item.idGrupo = (cliente && (cliente as any).idGrupo) || 0;

      // Determinar endpoint según idGrupo
      const endpoint =
        item.idGrupo === 0
          ? '/api/FRESKY/get-data-cfd-xml-clientes-addenda-fecha-nuevo'
          : '/api/FRESKY/get-data-cfd-xml-grupos-addenda-fecha-nuevo';

      const caja = item.caja !== undefined ? item.caja : 2;

      // Generar XML con los datos de la venta
      const xmlContent = this.generateXMLContent(selectedItems);

      // Construir URL con parámetros (mismo patrón que en tu web)
      const baseUrl =
        `${endpoint}?caja=${caja}&tipoComprobante=I` +
        `&idCliente=${item.idCliente}&requiereAddenda=false` +
        `&numeroFactura=&referenciaFactura=&fechaPedido=&numeroFolio=&fechaFolioRecibo=` +
        `&noUbicacionEntregar=&domicilioEmbarque=&ciudadDomicilio=&codigoPosta&fechaFactura=${encodeURIComponent(
          fechaFactura,
        )}`;

      const cleanUrl = baseUrl.replace(/\s+/g, '');

      // Llamar API de generación de factura
      const response = await fetch(`${this.apiBaseUrl}${cleanUrl}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(xmlContent),
      });
      console.log(response);
      console.log(cleanUrl);
      console.log(this.apiBaseUrl);
      console.log(xmlContent);
      console.log(JSON.stringify(xmlContent));
      let data: any = null;
      try {
        data = await response.json();
      } catch (e) {
        // Si no hay JSON, dejamos data en null
      }

      if (!response.ok) {
        let message = 'No se pudo generar la factura';
        if (data) {
          if (data.errMsg) {
            message = data.errMsg;
          } else if (data.mensaje) {
            message = data.mensaje;
          }
        }
        throw new Error(message);
      }

      const serie = data?.serie;
      const folio = data?.folio ?? data?.caja;
      if (!serie || folio == null) {
        throw new Error('El servidor no devolvió serie/folio de factura');
      }

      // Obtener e imprimir ticket CFDI
      await this.obtenerTicketCFDI(String(serie), String(folio));

      Alert.alert(
        'Éxito',
        `Factura ${serie}-${folio} generada e impresa correctamente`,
      );

      onSuccess();
    } catch (error: any) {
      const msg = error?.message || 'No se pudo generar la factura';
      Alert.alert('Error al generar factura', msg);
    }
  }

  async imprimirFacturaExistente(
    noVenta: number,
    sucursal: number,
    caja: number,
    onSuccess?: () => void,
  ): Promise<void> {
    try {
      const { serie, folio } = await this.obtenerSerieXml(
        noVenta,
        sucursal,
        caja,
      );

      await this.obtenerTicketCFDI(serie, folio);

      Alert.alert('Éxito', 'Factura impresa correctamente');

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      const msg = error?.message || 'No se pudo imprimir la factura';
      Alert.alert('Error al imprimir factura', msg);
      throw error;
    }
  }

  private async obtenerSerieXml(
    noVenta: number,
    sucursal: number,
    caja: number,
  ): Promise<{ serie: string; folio: string }> {
    const url = `${this.cppApiBaseUrl}/api/Cpp/serie-xml?noVenta=${noVenta}&sucursal=${sucursal}&caja=${caja}`;

    const response = await fetch(url, {
      headers: { accept: 'application/octet-stream' },
    });

    if (!response.ok) {
      throw new Error(`Error HTTP al obtener serie/folio: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.serie) {
      const serie = String(data.serie);
      const folio = data.caja?.toString?.() || data.folio?.toString?.() || '0';
      return { serie, folio };
    }

    throw new Error('Respuesta inválida al obtener serie/folio de factura');
  }

  private async obtenerTicketCFDI(serie: string, folio: string): Promise<void> {
    const url = `${
      this.cppApiBaseUrl
    }/api/Cpp/ticket-cfdi-pagos20?serie=${encodeURIComponent(
      serie,
    )}&folio=${encodeURIComponent(folio)}`;

    const response = await fetch(url, {
      headers: { accept: 'application/octet-stream' },
    });

    if (!response.ok) {
      throw new Error(`Error HTTP al obtener ticket CFDI: ${response.status}`);
    }

    let data: any;
    try {
      data = await response.json();
    } catch (e) {
      // Si el servidor no devuelve JSON, no podremos formatear el ticket
      throw new Error('Formato de respuesta inválido para ticket CFDI');
    }

    let lines: string[] = [];
    let qrData = '';

    if (Array.isArray(data)) {
      data.forEach((item: any, index: number) => {
        const line =
          typeof item === 'object'
            ? item.linea || JSON.stringify(item)
            : String(item);
        lines.push(line);

        if (!qrData && item.qr) {
          qrData = String(item.qr);
        }
      });
    } else {
      lines = [
        'FACTURA CFDI',
        `Serie-Folio: ${serie}-${folio}`,
        '--------------------------------',
        'VERIFICACION CFDI',
      ];
    }

    if (!qrData) {
      // Construir una URL genérica de verificación si no viene QR directo
      qrData = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${serie}-${folio}`;
    }

    lines.push('');
    lines.push('[CODIGO QR]');
    lines.push(qrData);
    lines.push('-'.repeat(32));

    await this.printTicketBluetooth(lines);
  }

  private async printTicketBluetooth(lines: string[]): Promise<void> {
    const status = BluetoothPrinterService.getStatus();
    if (!status.connected) {
      Alert.alert('Impresora', 'No hay impresora Bluetooth conectada');
      return;
    }

    await BluetoothPrinterService.printTicket(lines);
  }

  private generateXMLContent(items: FacturaItem[]): string {
    let xmlContent = '<dataroot>';

    items.forEach(item => {
      const sucursal = item.sucursal !== undefined ? item.sucursal : 44;
      xmlContent += '<venta>';
      xmlContent += `<sucursal>${sucursal}</sucursal>`;
      xmlContent += `<noventa>${item.noVenta}</noventa>`;
      xmlContent += `<idGrupo>${item.idGrupo}</idGrupo>`;
      xmlContent += `<idCliente>${item.idCliente}</idCliente>`;
      xmlContent += '</venta>';
    });

    xmlContent += '</dataroot>';
    return xmlContent;
  }
}

export default FacturaService;
