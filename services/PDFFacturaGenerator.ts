import { XMLParser } from 'fast-xml-parser';
import RNFS from 'react-native-fs';
import * as RNHTMLtoPDF from 'react-native-html-to-pdf';

interface FacturaData {
  serie: string;
  folio: string;
  fecha: string;
  noCertificado: string;
  sello: string;
  emisor: {
    rfc: string;
    nombre: string;
    regimenFiscal: string;
  };
  receptor: {
    rfc: string;
    nombre: string;
    usoCFDI: string;
    regimenFiscal: string;
    domicilioFiscal: string;
  };
  comprobante: {
    lugarExpedicion: string;
    tipoComprobante: string;
    metodoPago: string;
    formaPago: string;
    subTotal: number;
    total: number;
    moneda: string;
  };
  conceptos: Array<{
    cantidad: string;
    claveUnidad: string;
    claveProdServ: string;
    descripcion: string;
    valorUnitario: number;
    importe: number;
  }>;
  timbre: {
    uuid: string;
    fechaTimbrado: string;
    rfcProvCertif: string;
    noCertificadoSAT: string;
    selloCFD: string;
    selloSAT: string;
  };
  impuestos: {
    totalTraslados: number;
  };
}

class PDFFacturaGenerator {
  /**
   * Parsea el XML de la factura y extrae los datos necesarios
   */
  private parseXML(xmlContent: string): FacturaData {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });

    const parsedXML = parser.parse(xmlContent);

    // Navegar por el XML (con o sin namespace)
    const comprobante = parsedXML['cfdi:Comprobante'] || parsedXML.Comprobante;
    const emisor = comprobante['cfdi:Emisor'] || comprobante.Emisor;
    const receptor = comprobante['cfdi:Receptor'] || comprobante.Receptor;
    const conceptosNode =
      comprobante['cfdi:Conceptos'] || comprobante.Conceptos;
    const conceptosArray =
      conceptosNode['cfdi:Concepto'] || conceptosNode.Concepto;
    const complemento =
      comprobante['cfdi:Complemento'] || comprobante.Complemento;
    const timbreNode =
      complemento['tfd:TimbreFiscalDigital'] || complemento.TimbreFiscalDigital;
    const impuestosNode =
      comprobante['cfdi:Impuestos'] || comprobante.Impuestos;

    // Asegurar que conceptos sea array
    const conceptos = Array.isArray(conceptosArray)
      ? conceptosArray
      : [conceptosArray];

    const data: FacturaData = {
      serie: comprobante['@_Serie'] || '',
      folio: comprobante['@_Folio'] || '',
      fecha: comprobante['@_Fecha'] || '',
      noCertificado: comprobante['@_NoCertificado'] || '',
      sello: comprobante['@_Sello'] || '',
      emisor: {
        rfc: emisor['@_Rfc'] || '',
        nombre: emisor['@_Nombre'] || '',
        regimenFiscal: emisor['@_RegimenFiscal'] || '',
      },
      receptor: {
        rfc: receptor['@_Rfc'] || '',
        nombre: receptor['@_Nombre'] || '',
        usoCFDI: receptor['@_UsoCFDI'] || '',
        regimenFiscal: receptor['@_RegimenFiscalReceptor'] || '',
        domicilioFiscal: receptor['@_DomicilioFiscalReceptor'] || '',
      },
      comprobante: {
        lugarExpedicion: comprobante['@_LugarExpedicion'] || '',
        tipoComprobante: comprobante['@_TipoDeComprobante'] || '',
        metodoPago: comprobante['@_MetodoPago'] || '',
        formaPago: comprobante['@_FormaPago'] || '',
        subTotal: parseFloat(comprobante['@_SubTotal'] || '0'),
        total: parseFloat(comprobante['@_Total'] || '0'),
        moneda: comprobante['@_Moneda'] || 'MXN',
      },
      conceptos: conceptos.map((concepto: any) => ({
        cantidad: concepto['@_Cantidad'] || '0',
        claveUnidad: concepto['@_ClaveUnidad'] || '',
        claveProdServ: concepto['@_ClaveProdServ'] || '',
        descripcion: concepto['@_Descripcion'] || '',
        valorUnitario: parseFloat(concepto['@_ValorUnitario'] || '0'),
        importe: parseFloat(concepto['@_Importe'] || '0'),
      })),
      timbre: {
        uuid: timbreNode['@_UUID'] || '',
        fechaTimbrado: timbreNode['@_FechaTimbrado'] || '',
        rfcProvCertif: timbreNode['@_RfcProvCertif'] || '',
        noCertificadoSAT: timbreNode['@_NoCertificadoSAT'] || '',
        selloCFD: timbreNode['@_SelloCFD'] || '',
        selloSAT: timbreNode['@_SelloSAT'] || '',
      },
      impuestos: {
        totalTraslados: parseFloat(
          impuestosNode?.['@_TotalImpuestosTrasladados'] || '0',
        ),
      },
    };

    return data;
  }

  /**
   * Formatea moneda a formato mexicano
   */
  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(value);
  }

  /**
   * Genera HTML de la factura
   */
  private generateHTML(data: FacturaData): string {
    const conceptosHTML = data.conceptos
      .map(
        c => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${
            c.cantidad
          }</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${
            c.claveUnidad
          }</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${
            c.claveProdServ
          }</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${
            c.descripcion
          }</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${this.formatCurrency(
            c.valorUnitario,
          )}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${this.formatCurrency(
            c.importe,
          )}</td>
        </tr>
      `,
      )
      .join('');

    const iva = data.comprobante.total - data.comprobante.subTotal;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Factura ${data.serie}-${data.folio}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 10px; margin: 20px; }
          h1 { font-size: 18px; margin: 0; }
          h2 { font-size: 14px; margin: 10px 0; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          .header { background-color: #f5f5f5; padding: 10px; margin-bottom: 10px; }
          .section { margin: 15px 0; }
          .label { font-weight: bold; }
          .uuid { word-wrap: break-word; font-size: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FACTURA ELECTRÓNICA</h1>
          <p><strong>Serie:</strong> ${data.serie} <strong>Folio:</strong> ${
      data.folio
    }</p>
          <p><strong>Fecha:</strong> ${data.fecha}</p>
        </div>

        <div class="section">
          <h2>Emisor</h2>
          <p><strong>Nombre:</strong> ${data.emisor.nombre}</p>
          <p><strong>RFC:</strong> ${data.emisor.rfc}</p>
          <p><strong>Régimen Fiscal:</strong> ${data.emisor.regimenFiscal}</p>
        </div>

        <div class="section">
          <h2>Receptor</h2>
          <p><strong>Nombre:</strong> ${data.receptor.nombre}</p>
          <p><strong>RFC:</strong> ${data.receptor.rfc}</p>
          <p><strong>Uso CFDI:</strong> ${data.receptor.usoCFDI}</p>
          <p><strong>Método de Pago:</strong> ${data.comprobante.metodoPago}</p>
          <p><strong>Forma de Pago:</strong> ${data.comprobante.formaPago}</p>
        </div>

        <div class="section">
          <h2>Conceptos</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="border: 1px solid #ddd; padding: 8px;">Cant.</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Unidad</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Clave</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Descripción</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Precio</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Importe</th>
              </tr>
            </thead>
            <tbody>
              ${conceptosHTML}
            </tbody>
          </table>
        </div>

        <div class="section">
          <table style="width: 300px; float: right;">
            <tr>
              <td class="label">Subtotal:</td>
              <td style="text-align: right;">${this.formatCurrency(
                data.comprobante.subTotal,
              )}</td>
            </tr>
            <tr>
              <td class="label">IVA:</td>
              <td style="text-align: right;">${this.formatCurrency(iva)}</td>
            </tr>
            <tr style="background-color: #f5f5f5;">
              <td class="label">TOTAL:</td>
              <td style="text-align: right; font-weight: bold;">${this.formatCurrency(
                data.comprobante.total,
              )}</td>
            </tr>
          </table>
        </div>

        <div class="section" style="clear: both; margin-top: 20px;">
          <h2>Timbre Fiscal Digital</h2>
          <p><strong>UUID:</strong> <span class="uuid">${
            data.timbre.uuid
          }</span></p>
          <p><strong>Fecha Timbrado:</strong> ${data.timbre.fechaTimbrado}</p>
          <p><strong>No. Certificado SAT:</strong> ${
            data.timbre.noCertificadoSAT
          }</p>
          <p><strong>RFC Proveedor Certificación:</strong> ${
            data.timbre.rfcProvCertif
          }</p>
        </div>

        <div class="section">
          <p style="font-size: 8px;"><strong>Sello Digital del CFDI:</strong></p>
          <p style="font-size: 7px; word-wrap: break-word;">${data.sello.substring(
            0,
            200,
          )}...</p>
          <p style="font-size: 8px;"><strong>Sello Digital del SAT:</strong></p>
          <p style="font-size: 7px; word-wrap: break-word;">${data.timbre.selloSAT.substring(
            0,
            200,
          )}...</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Genera el PDF de la factura
   */
  async generatePDF(xmlContent: string): Promise<string> {
    try {
      console.log('[PDFFacturaGenerator] Iniciando generación de PDF...');

      const data = this.parseXML(xmlContent);
      console.log('[PDFFacturaGenerator] XML parseado:', {
        serie: data.serie,
        folio: data.folio,
        uuid: data.timbre.uuid,
      });

      const html = this.generateHTML(data);
      console.log(
        '[PDFFacturaGenerator] HTML generado, longitud:',
        html.length,
      );

      const options = {
        html,
        fileName: `factura_${data.serie}${data.folio}`,
        directory: 'Documents',
      };

      const file = await RNHTMLtoPDF.convert(options);
      console.log('[PDFFacturaGenerator] PDF generado en:', file.filePath);

      // Leer el archivo y convertir a base64
      const pdfBase64 = await RNFS.readFile(file.filePath || '', 'base64');
      console.log(
        '[PDFFacturaGenerator] PDF convertido a base64, longitud:',
        pdfBase64.length,
      );

      // Opcional: eliminar archivo temporal
      if (file.filePath) {
        await RNFS.unlink(file.filePath);
      }

      return pdfBase64;
    } catch (error) {
      console.error('[PDFFacturaGenerator] Error generando PDF:', error);
      throw error;
    }
  }
}

export default new PDFFacturaGenerator();
