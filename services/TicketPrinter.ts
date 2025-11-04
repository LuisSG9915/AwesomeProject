import { Alert, Platform, Share } from 'react-native';

export type TicketLine = string;

export type TicketContent = TicketLine[];

function normalize(lines: TicketContent): string {
  return lines.join('\n');
}

class TicketPrinter {
  async print(lines: TicketContent, title: string = 'Ticket') {
    const text = normalize(lines);

    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Share.share({ message: text, title });
        return;
      }
      Alert.alert(title, text);
    } catch (e: any) {
      Alert.alert('Impresión', e?.message || 'No fue posible imprimir');
    }
  }
}

export default new TicketPrinter();
