import { Alert } from 'react-native';
import BluetoothPrinterService from './BluetoothPrinterService';
import FullSyncService from './FullSyncService';

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

export interface FacturaResult {
  success: boolean;
  serie?: string;
  folio?: string;
  uuid?: string;
  xmlContent?: string;
  error?: string;
  correoCliente?: string;
}

class FacturaService {
  private static instance: FacturaService | null = null;

  private apiBaseUrl = 'https://cbinfo.no-ip.info:9004';
  private cppApiBaseUrl = 'https://cbinfo.no-ip.info:9011';
  private emailApiUrl = 'https://cbinfo.no-ip.info:9011/api/Email/send';

  static getInstance(): FacturaService {
    if (!FacturaService.instance) {
      FacturaService.instance = new FacturaService();
    }
    return FacturaService.instance;
  }

  private constructor() {}

  /**
   * Genera una factura y retorna el resultado con detalles
   */
  async generarFactura(
    selectedItems: FacturaItem[],
    fechaFactura: string,
    onSuccess: () => void,
  ): Promise<FacturaResult> {
    try {
      if (!selectedItems || selectedItems.length === 0) {
        const error = 'Debes seleccionar al menos una venta para facturar';
        Alert.alert('Error', error);
        return { success: false, error };
      }

      if (!fechaFactura) {
        const error = 'No se puede facturar sin fecha de factura';
        Alert.alert('Error', error);
        return { success: false, error };
      }

      // En esta app móvil sólo estamos facturando una venta a la vez
      const item = selectedItems[0];

      // Resolver idGrupo y correo desde Realm
      await FullSyncService.initialize();
      const cliente = FullSyncService.getClienteFullById
        ? FullSyncService.getClienteFullById(item.idCliente)
        : null;

      item.idGrupo = (cliente && (cliente as any).idGrupo) || 0;
      const correoCliente = (cliente as any)?.correoFactura || null;

      console.log('[FacturaService] Datos de cliente para factura:', {
        idCliente: item.idCliente,
        existeCliente: !!cliente,
        idGrupo: item.idGrupo,
        tieneCorreoFactura: !!correoCliente,
      });

      // Determinar endpoint según idGrupo
      const endpoint =
        item.idGrupo === 0
          ? '/api/FRESKY/get-data-cfd-xml-clientes-addenda-fecha-nuevo'
          : '/api/FRESKY/get-data-cfd-xml-grupos-addenda-fecha-nuevo';

      const caja = item.caja !== undefined ? item.caja : 2;

      if (caja === 1 || caja === 2) {
        const confirmed = await this.confirmarCaja(caja);
        if (!confirmed) {
          const errorMessage =
            caja === 1
              ? 'Facturación productiva cancelada por el usuario'
              : 'Facturación de prueba cancelada por el usuario';
          return {
            success: false,
            error: errorMessage,
            correoCliente,
          };
        }
      }

      const xmlContent = this.generateXMLContent(selectedItems);

      // Construir URL con parámetros
      const baseUrl =
        `${endpoint}?caja=${caja}&tipoComprobante=I` +
        `&idCliente=${item.idCliente}&requiereAddenda=false` +
        `&numeroFactura=&referenciaFactura=&fechaPedido=&numeroFolio=&fechaFolioRecibo=` +
        `&noUbicacionEntregar=&domicilioEmbarque=&ciudadDomicilio=&codigoPosta&fechaFactura=${encodeURIComponent(
          fechaFactura,
        )}`;

      const cleanUrl = baseUrl.replace(/\s+/g, '');

      console.log('[FacturaService] Generando factura...', {
        endpoint,
        apiUrl: `${this.apiBaseUrl}${cleanUrl}`,
        caja,
        sucursal: item.sucursal,
        noVenta: item.noVenta,
        idCliente: item.idCliente,
        idGrupo: item.idGrupo,
        fechaFactura,
      });

  
      // Llamar API de generación de factura
      const response = await fetch(`${this.apiBaseUrl}${cleanUrl}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(xmlContent),
      });

      // Intentar obtener respuesta como texto primero para debug
      const responseText = await response.text();
      let data: any = null;

      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.log(
          '[FacturaService] Respuesta no es JSON:',
          responseText.substring(0, 200),
        );
      }

      // Verificar errores HTTP
      if (!response.ok) {
        let errorMessage = `Error HTTP ${response.status}`;

        if (data) {
          if (data.errMsg) {
            errorMessage = data.errMsg;
          } else if (data.mensaje) {
            errorMessage = data.mensaje;
          } else if (data.error) {
            errorMessage = data.error;
          } else if (data.message) {
            errorMessage = data.message;
          }
        } else if (responseText) {
          errorMessage = responseText.substring(0, 300);
        }

      

    
        Alert.alert('Error al Generar Factura', errorMessage);
        return { success: false, error: errorMessage };
      }

      // Verificar respuesta exitosa
      const serie = data?.serie;
      const folio = data?.folio ?? data?.caja;
      const uuid = data?.uuid;

      if (!serie || folio == null) {
        const error = 'El servidor no devolvió serie/folio de factura';
        console.error('[FacturaService]', error, data);
        Alert.alert('Error', error);
        return { success: false, error };
      }

      console.log('[FacturaService] Factura generada:', { serie, folio, uuid });

      try {
        await FullSyncService.setVentaFolioFactura(item.noVenta, item.sucursal, true);
      } catch (realmError) {
        console.warn(
          '[FacturaService] No se pudo actualizar folioFactura en Realm:',
          realmError,
        );
      }

      let ticketWarning: string | null = null;

      // Obtener e imprimir ticket CFDI
      try {
        await this.obtenerTicketCFDI(String(serie), String(folio));
      } catch (ticketError: any) {
        ticketWarning =
          ticketError?.message || 'No se pudo obtener/imprimir el ticket CFDI';
        console.error('[FacturaService] Error al obtener ticket CFDI:', ticketError);
      }

      Alert.alert(
        '✅ Factura Generada',
        `Serie: ${serie}\nFolio: ${folio}${
          uuid ? `\nUUID: ${uuid}` : ''
        }${ticketWarning ? `\n\nAviso: ${ticketWarning}` : ''}\n\n¿Desea enviar por correo?`,
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Enviar',
            onPress: () => this.promptEnviarCorreo(serie, folio, correoCliente),
          },
        ],
      );

      onSuccess();

      return {
        success: true,
        serie: String(serie),
        folio: String(folio),
        uuid,
        xmlContent: typeof data === 'string' ? data : responseText,
        correoCliente,
      };
    } catch (error: any) {
      const errorMessage =
        error?.message || 'Error desconocido al generar factura';
      console.error('[FacturaService] Exception:', error);
      Alert.alert('Error al Generar Factura', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Muestra prompt para enviar factura por correo
   */
  private async promptEnviarCorreo(
    serie: string,
    folio: string,
    correoSugerido: string | null,
  ): Promise<void> {
    // En React Native no tenemos prompt nativo, usamos Alert con botones
    if (correoSugerido) {
      Alert.alert('Enviar Factura', `¿Enviar a ${correoSugerido}?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: () =>
            this.enviarFacturaPorCorreo(serie, folio, correoSugerido),
        },
      ]);
    } else {
      Alert.alert(
        'Sin correo',
        'El cliente no tiene correo de facturación registrado',
      );
    }
  }

  /**
   * Envía la factura por correo electrónico con PDF y XML adjuntos
   */
  async enviarFacturaPorCorreo(
    serie: string,
    folio: string,
    correoDestino: string,
  ): Promise<boolean> {
    try {
      console.log('[FacturaService] Enviando factura por correo...', {
        serie,
        folio,
        correoDestino,
      });

      // Obtener XML de la factura
      const xmlResponse = await fetch(
        `${this.cppApiBaseUrl}/api/Cpp/xml-cfdi?serie=${encodeURIComponent(
          serie,
        )}&folio=${encodeURIComponent(folio)}`,
        { headers: { accept: 'application/xml' } },
      );

      if (!xmlResponse.ok) {
        throw new Error('No se pudo obtener el XML de la factura');
      }

      const xmlContent = await xmlResponse.text();
      const xmlBase64 = this.base64Encode(xmlContent);

      // Obtener PDF de la factura
      const pdfResponse = await fetch(
        `${this.cppApiBaseUrl}/api/Cpp/pdf-cfdi?serie=${encodeURIComponent(
          serie,
        )}&folio=${encodeURIComponent(folio)}`,
        { headers: { accept: 'application/pdf' } },
      );

      let pdfBase64 = '';
      if (pdfResponse.ok) {
        const pdfBlob = await pdfResponse.blob();
        pdfBase64 = await this.blobToBase64(pdfBlob);
      }

      // Preparar datos del email
      const emailData = {
        to: `${correoDestino}, soporte@cbinformatica.net`,
        subject: 'FACTURA ELECTRONICA FRESKY HIELO',
        body: `Estimado cliente,\n\nAdjunto encontrará su factura ${serie}-${folio}.\n\nGracias por su preferencia.\n\nFRESKY HIELO`,
        attachmentPath: '',
        Attachments: [
          ...(pdfBase64
            ? [
                {
                  FileName: `${serie}-${folio}.pdf`,
                  FileContent: pdfBase64,
                  MimeType: 'application/pdf',
                },
              ]
            : []),
          {
            FileName: `${serie}-${folio}.xml`,
            FileContent: xmlBase64,
            MimeType: 'application/xml',
          },
        ],
      };

      const response = await fetch(this.emailApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Error al enviar correo');
      }

      Alert.alert('✅ Correo Enviado', `Factura enviada a ${correoDestino}`);
      return true;
    } catch (error: any) {
      const msg = error?.message || 'No se pudo enviar el correo';
      console.error('[FacturaService] Error enviando correo:', error);
      Alert.alert('Error al Enviar Correo', msg);
      return false;
    }
  }

  private confirmarCaja(caja: number): Promise<boolean> {
    const mensaje =
      caja === 1
        ? 'La factura se generará en CAJA 1 (PRODUCTIVO).\n\n¿Desea continuar?'
        : 'La factura se generará en CAJA 2 (PRUEBAS).\n\n¿Desea continuar?';

    return new Promise(resolve => {
      Alert.alert(
        'Confirmar facturación',
        mensaje,
        [
          {
            text: 'Cancelar',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Continuar',
            onPress: () => resolve(true),
          },
        ],
        { cancelable: false },
      );
    });
  }

  private base64Encode(str: string): string {
    // Codificar string a base64 compatible con React Native
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    let i = 0;

    const utf8Str = unescape(encodeURIComponent(str));

    while (i < utf8Str.length) {
      const chr1 = utf8Str.charCodeAt(i++);
      const chr2 = utf8Str.charCodeAt(i++);
      const chr3 = utf8Str.charCodeAt(i++);

      const enc1 = chr1 >> 2;
      const enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      const enc3 = isNaN(chr2) ? 64 : ((chr2 & 15) << 2) | (chr3 >> 6);
      const enc4 = isNaN(chr3) ? 64 : chr3 & 63;

      output +=
        chars.charAt(enc1) +
        chars.charAt(enc2) +
        chars.charAt(enc3) +
        chars.charAt(enc4);
    }

    return output;
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remover el prefijo "data:...;base64,"
        const base64Data = base64.split(',')[1] || base64;
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
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
    console.log('[FacturaService] Data:', data);
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
      throw new Error('Formato de respuesta inválido para ticket CFDI');
    }

    // Extraer datos del ticket para formato profesional
    let uuid = '';
    let fecha = '';
    let rfcEmisor = '';
    let rfcReceptor = '';
    let total = 0;
    let qrUrl = '';
    let selloDigital = '';
    const conceptos: Array<{
      descripcion: string;
      cantidad: number;
      precio: number;
      importe: number;
    }> = [];

    if (Array.isArray(data)) {
      data.forEach((item: any, index: number) => {
        // 1) Intentar leer campos estructurados si existen
        if (item.uuid) uuid = String(item.uuid);
        if (item.fecha) fecha = String(item.fecha);
        if (item.rfcEmisor) rfcEmisor = String(item.rfcEmisor);
        if (item.rfcReceptor) rfcReceptor = String(item.rfcReceptor);
        if (item.total) total = parseFloat(item.total) || total;
        if (item.qr) qrUrl = String(item.qr);
        if (item.sello || item.selloDigital)
          selloDigital = String(item.sello || item.selloDigital);

        // 2) Extraer conceptos si vienen estructurados
        if (item.descripcion && item.cantidad !== undefined) {
          conceptos.push({
            descripcion: String(item.descripcion),
            cantidad: parseFloat(item.cantidad) || 1,
            precio: parseFloat(item.precio || item.valorUnitario) || 0,
            importe: parseFloat(item.importe) || 0,
          });
        }

        // 3) Fallback: parsear texto como en el sistema viejo
        const line =
          typeof item === 'string'
            ? item
            : item.linea || item.descripcion || '';
        if (!line) {
          return;
        }

        const lower = line.toLowerCase();

        // UUID / Folio fiscal
        if (!uuid && (lower.includes('uuid:') || lower.includes('folio fiscal:'))) {
          const parts = line.split(':');
          if (parts.length > 1) {
            uuid = parts[1].trim();
          }
        }

        // RFC Emisor
        if (!rfcEmisor && lower.includes('rfc emisor')) {
          const parts = line.split(':');
          if (parts.length > 1) {
            rfcEmisor = parts[1].trim();
          }
        }

        // RFC Receptor
        if (!rfcReceptor && lower.includes('rfc receptor')) {
          const parts = line.split(':');
          if (parts.length > 1) {
            rfcReceptor = parts[1].trim();
          }
        }

        // Total
        if (!total && lower.includes('total')) {
          const match = line.match(/[0-9]+[0-9.,]*/);
          if (match) {
            const num = parseFloat(match[0].replace(',', ''));
            if (!isNaN(num)) {
              total = num;
            }
          }
        }

        // Sello CFD / Sello digital
        if (
          !selloDigital &&
          (lower.includes('sello cfd') || lower.includes('sello digital'))
        ) {
          const parts = line.split(':');
          if (parts.length > 1) {
            selloDigital = parts[1].trim();
          }
        }

        // QR directo en texto
        if (!qrUrl && lower.includes('qr:')) {
          const parts = line.split(':');
          if (parts.length > 1) {
            qrUrl = parts[1].trim();
          }
        }
      });
    }

    // Si no hay QR, construir URL de verificación SAT similar al sistema viejo
    if (!qrUrl) {
      if (uuid && rfcEmisor && rfcReceptor && total > 0) {
        const totalStr = total.toFixed(2);
        const selloLast8 = selloDigital ? selloDigital.slice(-8) : '';
        qrUrl = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${uuid}&re=${rfcEmisor}&rr=${rfcReceptor}&tt=${totalStr}&fe=${selloLast8}`;
      } else if (uuid) {
        qrUrl = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${uuid}`;
      } else {
        qrUrl = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${serie}-${folio}`;
      }
    }

    // Usar el nuevo método de impresión profesional con QR
    const status = BluetoothPrinterService.getStatus();
    if (!status.connected) {
      Alert.alert('Impresora', 'No hay impresora Bluetooth conectada');
      return;
    }

    await BluetoothPrinterService.printCFDITicket({
      serie,
      folio,
      uuid: uuid || undefined,
      fecha: fecha || new Date().toLocaleString('es-MX'),
      rfcEmisor: rfcEmisor || 'PHA030403QX9',
      rfcReceptor: rfcReceptor || undefined,
      total: total > 0 ? total : undefined,
      conceptos: conceptos.length > 0 ? conceptos : undefined,
      qrUrl,
      selloDigital: selloDigital || undefined,
    });
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
