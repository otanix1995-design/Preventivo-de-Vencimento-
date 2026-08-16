import jsPDF from 'jspdf';
import type { CartazItem, OpcoesPdfCartaz } from '../types';
import { decomporDescricaoTag, formatarCodigoSemZeros } from './cartazes';
import { getSingleTagTemplateImage } from './templateBackground';

/**
 * Generates an exact replica PDF for Offer Posters (Cartazes de Ofertas)
 * Matching the exact visual layout and coordinates of the official TAGG1-4 PDF references.
 *
 * Sheet format: A4 Landscape (297mm x 210mm)
 * 4 slots arranged in a 2x2 grid:
 * Slot 0 (Top-Left): x=5, y=5, w=142, h=98
 * Slot 1 (Top-Right): x=150, y=5, w=142, h=98
 * Slot 2 (Bottom-Left): x=5, y=107, w=142, h=98
 * Slot 3 (Bottom-Right): x=150, y=107, w=142, h=98
 */
export function gerarPdfCartazes(
  items: CartazItem[],
  opcoes: OpcoesPdfCartaz = { layout: '4_POR_PAGINA', tituloCabecalho: 'OFERTA', destacarVencimento: true }
) {
  if (!items || items.length === 0) return;

  // Flatten items based on quantidadeCartazes
  const expandedItems: CartazItem[] = [];
  items.forEach((item) => {
    const qty = Math.max(1, item.quantidadeCartazes || 1);
    for (let i = 0; i < qty; i++) {
      expandedItems.push(item);
    }
  });

  if (expandedItems.length === 0) return;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const tagW = 142; // mm
  const tagH = 98;  // mm

  // Positions on A4 Landscape (297mm x 210mm) - Exact 2x2 Grid matching TAGG1-4
  const gridPositions = [
    { x: 5, y: 5 },
    { x: 150, y: 5 },
    { x: 5, y: 107 },
    { x: 150, y: 107 },
  ];

  const singleTagImg = getSingleTagTemplateImage();
  const totalPages = Math.ceil(expandedItems.length / 4);

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) {
      doc.addPage('a4', 'landscape');
    }

    // Process up to 4 items for this page
    for (let slot = 0; slot < 4; slot++) {
      const itemIndex = page * 4 + slot;
      if (itemIndex >= expandedItems.length) break;

      const item = expandedItems[itemIndex];
      const pos = gridPositions[slot];

      // 1. Draw Official Graphic Background for this tag slot
      if (singleTagImg) {
        doc.addImage(singleTagImg, 'PNG', pos.x, pos.y, tagW, tagH, undefined, 'FAST');
      }

      // 2. Draw Dynamic Content Overlaid on the Exact Coordinates
      renderDynamicTagContent(doc, item, pos.x, pos.y, tagW, tagH);
    }
  }

  // Save / Trigger Download
  const timestamp = new Date().toISOString().slice(0, 10);
  doc.save(`Cartazes_Ofertas_TAGG_${timestamp}.pdf`);
}

/**
 * Renders ONLY the requested dynamic layers on top of the template:
 * 1. Descrição da mercadoria (Tipo, Marca, Variação, Embalagem, Caixa)
 * 2. Preço do produto (R$, Números Gigantes, Centavos, Tributos, Media Kg)
 * 3. Validade de Vencimento
 * 4. Código da mercadoria com QR Code e Código de Barras (:p:codigo:d:dig)
 */
function renderDynamicTagContent(
  doc: jsPDF,
  item: CartazItem,
  cardX: number,
  cardY: number,
  w: number,
  h: number
) {
  const parsed = decomporDescricaoTag(item.descricao, item.marca);
  const centerX = cardX + 38;

  // ==========================================
  // 1. DESCRIÇÃO DA MERCADORIA (COLUNA ESQUERDA)
  // ==========================================
  // Linha 1: Tipo Principal (ex: "LEITE", "IOGURTE", "BEB.LACTEA", "MORTADELA")
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bolditalic');
  const tipoText = parsed.tipo || item.descricao.slice(0, 18);
  doc.setFontSize(tipoText.length > 12 ? 14 : 16);
  doc.text(tipoText, centerX, cardY + 36, { align: 'center' });

  // Linha 2: Marca (ex: "BOB ESPONJA", "BATAVO", "ELEGE", "AURORA")
  if (parsed.marcaLinha) {
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(parsed.marcaLinha.length > 14 ? 13 : 15);
    doc.text(parsed.marcaLinha, centerX, cardY + 44, { align: 'center' });
  }

  // Linha 3: Sabor / Variação (ex: "MORANGO", "JABUTICABA", "POLPA MG/AMEIXA", "TRADICIONAL")
  if (parsed.variacao) {
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(parsed.variacao.length > 18 ? 9.5 : 11);
    doc.text(parsed.variacao, centerX, cardY + 51, { align: 'center' });
  }

  // Linha 4: Embalagem (ex: "(6X80G)", "(170G)", "(510G)", "(1150G)", "(KG 1 X 1000 X 1G)")
  const embRaw = (item.embalagem || 'UN').trim();
  const embFmt = embRaw.startsWith('(') ? embRaw : `(${embRaw})`;
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(10.5);
  doc.text(embFmt, centerX, cardY + 58, { align: 'center' });

  // Linha 5: Validade de Vencimento (se houver)
  if (item.dataVencimento) {
    const parts = item.dataVencimento.split('-');
    const valStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : item.dataVencimento;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(`VALIDADE: ${valStr}`, centerX, cardY + 65, { align: 'center' });
  }

  // Linha 6: Informação de Caixa Atacado (ex: "CXA C/ 5 R$ 24,95")
  if (item.unidadesPorCaixa && item.unidadesPorCaixa > 1 && item.precoCaixa) {
    const cxaStr = `CXA C/ ${item.unidadesPorCaixa} R$ ${item.precoCaixa.toFixed(2).replace('.', ',')}`;
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(9.5);
    doc.text(cxaStr, centerX + 14, cardY + 72, { align: 'center' });
  }

  // ==========================================
  // 2. CÓDIGO DA MERCADORIA COM QR CODE E BARRAS (RODAPÉ INFERIOR ESQUERDO)
  // ==========================================
  const miniQrX = cardX + 6;
  const miniQrY = cardY + 81;
  const miniQrSize = 7.0;

  doc.setFillColor(0, 0, 0);
  doc.rect(miniQrX, miniQrY, miniQrSize, miniQrSize, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(miniQrX + 0.6, miniQrY + 0.6, miniQrSize - 1.2, miniQrSize - 1.2, 'F');
  doc.setFillColor(0, 0, 0);
  doc.rect(miniQrX + 1.2, miniQrY + 1.2, 1.8, 1.8, 'F');
  doc.rect(miniQrX + miniQrSize - 3.0, miniQrY + 1.2, 1.8, 1.8, 'F');
  doc.rect(miniQrX + 1.2, miniQrY + miniQrSize - 3.0, 1.8, 1.8, 'F');
  doc.rect(miniQrX + 2.7, miniQrY + 2.7, 1.6, 1.6, 'F');

  // Código de barras linear
  const barX = cardX + 15;
  const barY = cardY + 81;
  const barH = 6.5;

  doc.setFillColor(0, 0, 0);
  const barWidths = [
    0.5, 0.25, 0.7, 0.35, 0.8, 0.25, 0.5, 0.6, 0.35, 0.6, 0.8, 0.25, 0.5, 0.7, 0.35,
    0.6, 0.35, 0.8, 0.5, 0.25, 0.6, 0.35, 0.7, 0.25, 0.5,
  ];
  let curBarX = barX;
  barWidths.forEach((bw, i) => {
    if (i % 2 === 0) {
      doc.rect(curBarX, barY, bw, barH, 'F');
    }
    curBarX += bw + 0.35;
  });

  // Linha formatada do código :p:codigo:d:dig
  const cleanCod = formatarCodigoSemZeros(item.codigo);
  const cleanDig = item.dig ? item.dig.replace(/^0+/, '') || item.dig : '0';
  const codeStr = `:p:${cleanCod}:d:${cleanDig}`;

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(codeStr, barX + 1, cardY + 93.5);

  // ==========================================
  // 3. PREÇO DO PRODUTO (NÚMEROS GIGANTES EM VERMELHO)
  // ==========================================
  // Símbolo R$
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(13);
  doc.text('R$', cardX + 74, cardY + 32);

  // Formatação do preço
  const priceVal = item.precoVenda !== null && item.precoVenda !== undefined ? item.precoVenda : 0;
  const priceStr = priceVal.toFixed(2);
  const [intPart, decPart] = priceStr.split('.');

  // Dígitos inteiros gigantes em vermelho (#C8102E / #E01A22)
  doc.setTextColor(208, 30, 30);
  doc.setFont('helvetica', 'bolditalic');

  const isMultiDigit = intPart.length >= 2;
  doc.setFontSize(isMultiDigit ? 76 : 88);
  const intX = isMultiDigit ? cardX + 70 : cardX + 78;
  doc.text(intPart, intX, cardY + 68);

  // Centavos elevados ao topo (.99 / .19 / .29 / .90)
  const intWidth = doc.getTextWidth(intPart);
  doc.setFontSize(48);
  doc.text(`,${decPart}`, intX + intWidth + 1.0, cardY + 48);

  // Tributos e Média Kg (alinhados ao lado direito)
  const infoX = cardX + 115;

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  const tribStr = item.infoTributaria || 'TRIB: R$ 0,00 (0,00)%';
  doc.text(tribStr, infoX, cardY + 66, { align: 'right' });

  if (item.precoKg) {
    doc.setFontSize(7.5);
    const mediaKgStr = `Media Kg R$ ${item.precoKg.toFixed(2).replace('.', ',')}`;
    doc.text(mediaKgStr, infoX, cardY + 71.5, { align: 'right' });
  }
}
