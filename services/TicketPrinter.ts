import { Alert, Platform, Share } from 'react-native';
import BluetoothPrinterService from './BluetoothPrinterService';

export type TicketLine = string;
export type TicketContent = TicketLine[];

export interface TicketOptions {
  title?: string;
  width?: number;
  encoding?: string;
}

export interface SaleTicketData {
  clientName: string;
  paymentMethod: string;
  items: Array<{
    description: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  total: number;
  date?: Date;
  ticketNumber?: string;
  businessName?: string;
  businessAddress?: string;
  taxId?: string;
  sellerName?: string;
  branch?: number | string;
}

export interface PrecorteTicketData {
  date: Date;
  items: Array<{
    product: string;
    entries: number;
    exits: number;
    inventory: number;
  }>;
  totalCash: number;
  totalSales?: number;
  totalExpenses?: number;
}

class TicketPrinter {
  private readonly DEFAULT_WIDTH = 32;

  /**
   * Normaliza las líneas del ticket en un string
   */
  private normalize(lines: TicketContent): string {
    return lines.join('\n');
  }

  /**
   * Crea una línea separadora
   */
  separator(char: string = '=', width: number = this.DEFAULT_WIDTH): string {
    return char.repeat(width);
  }

  /**
   * Centra un texto en el ancho especificado
   */
  center(text: string, width: number = this.DEFAULT_WIDTH): string {
    if (text.length >= width) return text;
    const padding = Math.floor((width - text.length) / 2);
    return ' '.repeat(padding) + text + ' '.repeat(width - padding - text.length);
  }

  /**
   * Formatea una línea con texto a la izquierda y valor a la derecha
   */
  leftRight(
    left: string,
    right: string,
    width: number = this.DEFAULT_WIDTH,
  ): string {
    const totalLen = left.length + right.length;
    if (totalLen >= width) {
      return `${left}${right}`;
    }
    const spaces = width - totalLen;
    return `${left}${' '.repeat(spaces)}${right}`;
  }

  /**
   * Genera un ticket de venta genérico
   */
  generateSaleTicket(data: SaleTicketData): TicketContent {
    const lines: TicketContent = [];
    const date = data.date || new Date();
    const width = this.DEFAULT_WIDTH;

    const businessName = data.businessName || 'FRESKY HIELO';

    // Encabezado de empresa
    lines.push(this.separator());
    lines.push(this.center(businessName, width));

    if (data.businessAddress) {
      lines.push(this.center(data.businessAddress, width));
    } else {
      lines.push(this.center('Productores de hielo y agua', width));
      lines.push(this.center('purificados del golfo', width));
    }

    if (data.taxId) {
      lines.push(this.center(`RFC: ${data.taxId}`, width));
    } else {
      lines.push(this.center('RFC: PHA030403QX9', width));
    }

    lines.push(this.center('TEL 01 279 8 34 21 10', width));
    lines.push(this.separator('-'));

    // Fecha y datos generales
    lines.push(`Fecha: ${date.toLocaleString('es-MX')}`);

    if (data.sellerName) {
      lines.push(`Vendedor: ${data.sellerName}`);
    }

    if (data.branch !== undefined) {
      lines.push(`Sucursal: ${String(data.branch)}`);
    }

    lines.push(`Cliente: ${data.clientName}`);

    if (data.ticketNumber) {
      lines.push(`Id Venta: ${data.ticketNumber}`);
    }

    lines.push(this.separator('-'));

    // Encabezado de productos (ancho fijo)
    lines.push('CANT  DESC       PRECIO  IMPORTE');

    // Detalle de productos
    data.items.forEach(item => {
      const cantidad = item.quantity.toString().padEnd(4).substring(0, 4);
      const desc = item.description.substring(0, 10).padEnd(10);
      const precio = `$${item.price.toFixed(2)}`;
      const importe = `$${item.total.toFixed(2)}`;
      const precioCol = precio.padStart(7).substring(0, 7);
      const importeCol = importe.padStart(8).substring(0, 8);

      const linea = `${cantidad}  ${desc}${precioCol} ${importeCol}`;
      lines.push(linea);
    });

    lines.push(this.separator('-'));

    // Forma de pago y total
    const metodo = (data.paymentMethod || '').toString().toLowerCase();
    let metodoLabel = 'EFECTIVO';
    if (metodo.includes('cred')) metodoLabel = 'CREDITO';
    else if (metodo.includes('trans')) metodoLabel = 'TRANSFERENCIA';

    lines.push(this.center('FORMA DE PAGO', width));
    lines.push(this.leftRight(metodoLabel, `$${data.total.toFixed(2)}`, width));

    lines.push(this.separator());
    lines.push(this.center('GRACIAS POR SU COMPRA', width));
    lines.push(this.separator());

    return lines;
  }

  /**
   * Genera un ticket de precorte
   */
  generatePrecorteTicket(data: PrecorteTicketData): TicketContent {
    const lines: TicketContent = [];
    const width = this.DEFAULT_WIDTH;

    // Encabezado
    lines.push(this.separator('=', width));
    // Dejar el título sin centrar para evitar cortes raros en algunas impresoras
    lines.push('PRECORTE');
    lines.push(this.separator('=', width));

    // Fecha y hora (zona horaria México)
    const fechaHoraActual = data.date.toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    } as any);
    lines.push(`FECHA: ${fechaHoraActual}`);
    lines.push(this.separator('=', width));

    // Encabezado de tabla: descripción y saldo
    lines.push(this.leftRight('DESCRIPCION', 'SALDO', width));
    lines.push(this.separator('-', width));

    // Datos de productos: una sola línea por producto (descripcion + saldo)
    if (data.items.length > 0) {
      data.items.forEach(item => {
        const maxDescLen = width - 10; // dejar espacio para el saldo y separador
        const desc = item.product.toString().substring(0, maxDescLen);
        const saldo = item.inventory.toFixed(1);
        const saldoCol = saldo.padStart(8);
        lines.push(this.leftRight(desc, saldoCol, width));
      });
    } else {
      lines.push('  No hay datos disponibles');
    }

    lines.push(this.separator('=', width));
    lines.push('');

    // Total efectivo
    lines.push(`TOTAL EFECTIVO: $${data.totalCash.toFixed(2)}`);
    lines.push('');
    lines.push(this.separator('=', width));
    lines.push('');

    return lines;
  }

  /**
   * Genera un ticket genérico de cobranza
   */
  generateBillingTicket(
    clientName: string,
    invoices: Array<{ nota: string; importe: number }>,
    paymentMethod: string,
    total: number,
  ): TicketContent {
    const lines: TicketContent = [];

    lines.push(this.separator());
    lines.push(this.center('COMPROBANTE DE PAGO'));
    lines.push(this.separator());
    lines.push(`FECHA: ${new Date().toLocaleString('es-MX')}`);
    lines.push(`CLIENTE: ${clientName}`);
    lines.push(`FORMA DE PAGO: ${paymentMethod}`);
    lines.push(this.separator('-'));

    lines.push('FACTURAS PAGADAS:');
    invoices.forEach(inv => {
      lines.push(this.leftRight(inv.nota, `$${inv.importe.toFixed(2)}`));
    });

    lines.push(this.separator('-'));
    lines.push(this.leftRight('TOTAL PAGADO:', `$${total.toFixed(2)}`));
    lines.push(this.separator());
    lines.push(this.center('¡GRACIAS POR SU PAGO!'));
    lines.push(this.separator());

    return lines;
  }

  /**
   * Imprime un ticket genérico
   */
  async print(
    lines: TicketContent,
    options: TicketOptions | string = {},
  ): Promise<void> {
    // Compatibilidad con versión anterior (cuando se pasaba solo el título)
    const opts: TicketOptions =
      typeof options === 'string' ? { title: options } : options;
    const title = opts.title || 'Ticket';

    const text = this.normalize(lines);

    try {
      // Intentar imprimir en impresora Bluetooth primero
      const printerStatus = BluetoothPrinterService.getStatus();
      
      if (printerStatus.connected) {
        const success = await BluetoothPrinterService.printTicket(lines);
        if (success) {
          return; // Impresión exitosa
        }
        // Si falla, continuar con método alternativo
      }

      // Método alternativo: compartir o mostrar
      Alert.alert(
        'Impresora No Configurada',
        '¿Deseas configurar una impresora Bluetooth o compartir el ticket?',
        [
          {
            text: 'Compartir',
            onPress: async () => {
              if (Platform.OS === 'ios' || Platform.OS === 'android') {
                await Share.share({
                  message: text,
                  title: title,
                });
              }
            },
          },
          {
            text: 'Configurar Impresora',
            onPress: () => {
              Alert.alert(
                'Configuración',
                'Ve al menú principal y selecciona "Configuración de Impresora"',
              );
            },
          },
          { text: 'Cancelar', style: 'cancel' },
        ],
      );
    } catch (e: any) {
      Alert.alert('Error de Impresión', e?.message || 'No fue posible imprimir el ticket');
    }
  }

  /**
   * Imprime un ticket de venta
   */
  async printSaleTicket(data: SaleTicketData): Promise<void> {
    const lines = this.generateSaleTicket(data);
    await this.print(lines, { title: 'Ticket de Venta' });
  }

  /**
   * Imprime un ticket de precorte
   */
  async printPrecorteTicket(data: PrecorteTicketData): Promise<void> {
    const lines = this.generatePrecorteTicket(data);
    await this.print(lines, { title: 'Precorte' });
  }

  /**
   * Imprime un ticket de cobranza
   */
  async printBillingTicket(
    clientName: string,
    invoices: Array<{ nota: string; importe: number }>,
    paymentMethod: string,
    total: number,
  ): Promise<void> {
    const lines = this.generateBillingTicket(clientName, invoices, paymentMethod, total);
    await this.print(lines, { title: 'Comprobante de Pago' });
  }
}

export default new TicketPrinter();
