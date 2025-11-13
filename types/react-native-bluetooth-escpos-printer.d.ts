declare module 'react-native-bluetooth-escpos-printer' {
  export interface BluetoothDevice {
    name: string;
    address: string;
  }

  export interface PrintOptions {
    encoding?: string;
    codepage?: number;
    widthtimes?: number;
    heigthtimes?: number;
    fonttype?: number;
    align?: 'left' | 'center' | 'right';
  }

  export class BluetoothManager {
    static isBluetoothEnabled(): Promise<boolean>;
    static enableBluetooth(): Promise<string>;
    static disableBluetooth(): Promise<string>;
    static scanDevices(): Promise<string>;
    static connect(address: string): Promise<string>;
    static disconnect(): Promise<string>;
    static isConnected(): Promise<boolean>;
  }

  export class BluetoothEscposPrinter {
    static printerInit(): Promise<void>;
    static printerLeftSpace(space: number): Promise<void>;
    static printerLineSpace(space: number): Promise<void>;
    static printerUnderLine(line: number): Promise<void>;
    static printerAlign(align: number): Promise<void>;
    static printText(text: string, options: PrintOptions): Promise<void>;
    static printColumn(
      columnWidths: number[],
      columnAligns: number[],
      columnTexts: string[],
      options: PrintOptions,
    ): Promise<void>;
    static setBlob(weight: number): Promise<void>;
    static printPic(base64: string, options: PrintOptions): Promise<void>;
    static printBarCode(
      barcode: string,
      barcodeType: number,
      width: number,
      height: number,
      textPosition: number,
    ): Promise<void>;
    static printQRCode(qrcode: string, size: number, correction: number): Promise<void>;
    static rotate(rotate: number): Promise<void>;
  }

  export class BluetoothTscPrinter {
    static printLabel(options: any): Promise<void>;
  }
}
