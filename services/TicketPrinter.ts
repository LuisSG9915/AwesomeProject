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

    // Header
    lines.push(this.separator());
    if (data.businessName) {
      lines.push(this.center(data.businessName));
    }
    if (data.businessAddress) {
      lines.push(this.center(data.businessAddress));
    }
    if (data.taxId) {
      lines.push(this.center(`RFC: ${data.taxId}`));
    }
    lines.push(this.separator());
    lines.push(this.center('TICKET DE VENTA'));
    lines.push(this.separator());

    // Información general
    if (data.ticketNumber) {
      lines.push(`TICKET: ${data.ticketNumber}`);
    }
    lines.push(`FECHA: ${date.toLocaleString('es-MX')}`);
    lines.push(`CLIENTE: ${data.clientName}`);
    lines.push(`PAGO: ${data.paymentMethod}`);
    lines.push(this.separator('-'));

    // Items
    lines.push(this.leftRight('DESCRIPCIÓN', 'IMPORTE'));
    lines.push(this.separator('-'));

    data.items.forEach(item => {
      const desc = item.description.substring(0, 20);
      lines.push(desc);
      const qtyPrice = `${item.quantity} x $${item.price.toFixed(2)}`;
      const total = `$${item.total.toFixed(2)}`;
      lines.push(this.leftRight(qtyPrice, total));
    });

    // Total
    lines.push(this.separator('-'));
    lines.push(this.leftRight('TOTAL:', `$${data.total.toFixed(2)}`));
    lines.push(this.separator());
    lines.push(this.center('¡GRACIAS POR SU COMPRA!'));
    lines.push(this.separator());

    return lines;
  }

  /**
   * Genera un ticket de precorte
   */
  generatePrecorteTicket(data: PrecorteTicketData): TicketContent {
    const lines: TicketContent = [];

    lines.push(this.separator());
    lines.push(this.center('PRECORTE'));
    lines.push(this.separator());
    lines.push(`FECHA: ${data.date.toLocaleString('es-MX')}`);
    lines.push(this.separator('-'));

    // Headers
    lines.push('PRODUCTO');
    lines.push('  ENTRADA  SALIDA    IF');
    lines.push(this.separator('-'));

    // Items
    data.items.forEach(item => {
      const prod = item.product.substring(0, this.DEFAULT_WIDTH);
      lines.push(prod);
      const ent = item.entries.toFixed(1).padStart(8);
      const sal = item.exits.toFixed(1).padStart(8);
      const inv = item.inventory.toFixed(1).padStart(8);
      lines.push(`${ent}${sal}${inv}`);
    });

    lines.push(this.separator('-'));
    lines.push(this.leftRight('TOTAL EFECTIVO:', `$${data.totalCash.toFixed(2)}`));

    if (data.totalSales !== undefined) {
      lines.push(this.leftRight('TOTAL VENTAS:', `$${data.totalSales.toFixed(2)}`));
    }
    if (data.totalExpenses !== undefined) {
      lines.push(this.leftRight('TOTAL GASTOS:', `$${data.totalExpenses.toFixed(2)}`));
    }

    lines.push(this.separator());

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
