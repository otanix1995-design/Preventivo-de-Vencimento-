import jsPDF from 'jspdf';
import type { CartazItem, OpcoesPdfCartaz } from '../types';
import { decomporDescricaoTag, formatarCodigoSemZeros } from './cartazes';
import { getTemplatePngDataUrl, type TemplateKey } from './templateBackground';

/**
 * Standard fixed slot coordinates for A4 Landscape (297mm x 210mm)
 * Compatible with all official TAGG templates (TAGG1, TAGG2, TAGG3, TAGG4)
 */
const TAGG_SLOTS = [
  { x: 5, y: 5 },     // Slot 0: Top-Left
  { x: 150, y: 5 },   // Slot 1: Top-Right
  { x: 5, y: 107 },   // Slot 2: Bottom-Left
  { x: 150, y: 107 }, // Slot 3: Bottom-Right
];

/**
 * Escolhe obrigatoriamente o template PNG oficial conforme a quantidade de produtos da página:
 * 1 produto → TAGG1_LIMPO.png
 * 2 produtos → TAGG2_LIMPO.png (PROIBIDO carregar TAGG1_LIMPO se houver 2 produtos)
 * 3 produtos → TAGG3_LIMPO.png
 * 4 produtos → TAGG4_LIMPO.png
 */
export function escolherTemplatePorQuantidade(quantidadeProdutosPagina: number): TemplateKey {
  if (quantidadeProdutosPagina === 1) {
    return 'TAGG1_LIMPO';
  }
  if (quantidadeProdutosPagina === 2) {
    return 'TAGG2_LIMPO';
  }
  if (quantidadeProdutosPagina === 3) {
    return 'TAGG3_LIMPO';
  }
  return 'TAGG4_LIMPO';
}

/**
 * Generates official Offer Posters PDF using the exact clean templates as immutable backgrounds.
 * 
 * Rules:
 * - NEVER redraws headers, green/orange bars, "OFERTA", QR codes, lines or decorative wings.
 * - Directly embeds the official clean template file (TAGG1_LIMPO, TAGG2_LIMPO, TAGG3_LIMPO, TAGG4_LIMPO).
 * - Overlays ONLY dynamic product variables in the exact fixed slot positions.
 * - STRICTLY NO Tributação and NO Média por KG.
 */
export async function gerarPdfCartazes(
  items: CartazItem[],
  _opcoes?: OpcoesPdfCartaz
): Promise<void> {
  if (!items || items.length === 0) return;

  // Flatten items based on individual copies count (quantidadeCartazes)
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

  let itemIdx = 0;
  let pageIndex = 0;

  while (itemIdx < expandedItems.length) {
    const remaining = expandedItems.length - itemIdx;
    
    // Conta quantos produtos serão colocados nesta página antes de escolher o template
    const itemsOnThisPage = Math.min(remaining, 4);

    // Escolha exclusiva do template correspondente à contagem exata da página
    const templateKey = escolherTemplatePorQuantidade(itemsOnThisPage);

    // Confirmação em runtime/log
    console.log(`Quantidade de produtos da página: ${itemsOnThisPage}`);
    console.log(`Template carregado: ${templateKey}.png`);

    if (pageIndex > 0) {
      doc.addPage('a4', 'landscape');
    }

    // 1. Draw the official clean background template covering the entire A4 sheet (297mm x 210mm)
    try {
      const bgImage = await getTemplatePngDataUrl(templateKey);
      if (bgImage) {
        doc.addImage(bgImage, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
      }
    } catch (err) {
      console.error('Error adding template background image to PDF:', err);
    }

    // 2. Overlay dynamic product text for each slot on this page
    for (let slot = 0; slot < itemsOnThisPage; slot++) {
      const item = expandedItems[itemIdx + slot];
      renderDynamicSlotContent(doc, item, slot);
    }

    itemIdx += itemsOnThisPage;
    pageIndex++;
  }

  // Save / Trigger Download
  const timestamp = new Date().toISOString().slice(0, 10);
  doc.save(`Cartazes_Ofertas_TAGG_${timestamp}.pdf`);
}

/**
 * Overlays ONLY dynamic variable fields onto the fixed coordinates of the given slot.
 */
function renderDynamicSlotContent(
  doc: jsPDF,
  item: CartazItem,
  slot: number
) {
  const pos = TAGG_SLOTS[slot] || TAGG_SLOTS[0];
  const centerX = pos.x + 38;

  const parsed = decomporDescricaoTag(item.descricao, item.marca);
  const cleanCod = formatarCodigoSemZeros(item.codigo);
  const cleanDig = item.dig ? item.dig.replace(/^0+/, '') || item.dig : '0';
  const codeStr = `:p:${cleanCod}:d:${cleanDig}`;

  // Formatted packaging
  const embRaw = (item.embalagem || 'UN').trim();
  const embFmt = embRaw.startsWith('(') ? embRaw : `(${embRaw})`;

  // Formatted expiration date (Validade)
  let validadeStr = '';
  if (item.dataVencimento) {
    const parts = item.dataVencimento.split('-');
    validadeStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : item.dataVencimento;
  }

  // Price parts
  const priceVal = item.precoVenda !== null && item.precoVenda !== undefined ? item.precoVenda : 0;
  const priceStr = priceVal.toFixed(2);
  const [intPart, decPart] = priceStr.split('.');

  // ---------------------------------------------------------
  // 1. LEFT COLUMN: Product Description
  // ---------------------------------------------------------
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bolditalic');

  // Line 1: Tipo (e.g. LEITE)
  const tipoText = parsed.tipo || item.descricao.slice(0, 18);
  doc.setFontSize(tipoText.length > 12 ? 14 : 16);
  doc.text(tipoText, centerX, pos.y + 36, { align: 'center' });

  // Line 2: Marca (e.g. BOB ESPONJA)
  if (parsed.marcaLinha) {
    doc.setFontSize(parsed.marcaLinha.length > 14 ? 13 : 15);
    doc.text(parsed.marcaLinha, centerX, pos.y + 44, { align: 'center' });
  }

  // Line 3: Variacao / Sabor (e.g. MORANGO)
  if (parsed.variacao) {
    doc.setFontSize(parsed.variacao.length > 18 ? 9.5 : 11);
    doc.text(parsed.variacao, centerX, pos.y + 51, { align: 'center' });
  }

  // Line 4: Embalagem (e.g. (6X80G))
  doc.setFontSize(10.5);
  doc.text(embFmt, centerX, pos.y + 58, { align: 'center' });

  // Line 5: Validade (if present)
  if (validadeStr) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(`VALIDADE: ${validadeStr}`, centerX, pos.y + 65, { align: 'center' });
  }

  // Line 6: Preço da Caixa (if present)
  if (item.unidadesPorCaixa && item.unidadesPorCaixa > 1 && item.precoCaixa) {
    const cxaStr = `CXA C/ ${item.unidadesPorCaixa} R$ ${item.precoCaixa.toFixed(2).replace('.', ',')}`;
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(9.5);
    doc.text(cxaStr, centerX + 14, pos.y + 72, { align: 'center' });
  }

  // ---------------------------------------------------------
  // 2. BOTTOM LEFT: Technical Barcode & Code String
  // ---------------------------------------------------------
  renderBarcodeAndCode(
    doc,
    pos.x + 6,
    pos.y + 80,
    6.5,
    pos.x + 14,
    pos.y + 80,
    6.0,
    codeStr,
    pos.x + 15,
    pos.y + 92,
    8.5
  );

  // ---------------------------------------------------------
  // 3. RIGHT COLUMN: Giant Price Display
  // ---------------------------------------------------------
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(13);
  doc.text('R$', pos.x + 74, pos.y + 32);

  doc.setTextColor(208, 30, 30);
  const isMultiDigit = intPart.length >= 2;
  doc.setFontSize(isMultiDigit ? 76 : 88);
  const intX = isMultiDigit ? pos.x + 70 : pos.x + 78;
  doc.text(intPart, intX, pos.y + 68);

  const intWidth = doc.getTextWidth(intPart);
  doc.setFontSize(48);
  doc.text(`,${decPart}`, intX + intWidth + 1.0, pos.y + 48);

  // STRICT RULE: NO Tributação and NO Média por KG are rendered.
}

/**
 * Helper to render mini QR code, barcode lines and technical code string
 */
function renderBarcodeAndCode(
  doc: jsPDF,
  qrX: number,
  qrY: number,
  qrSize: number,
  barX: number,
  barY: number,
  barH: number,
  codeStr: string,
  textX: number,
  textY: number,
  fontSize: number
) {
  // Mini QR
  doc.setFillColor(0, 0, 0);
  doc.rect(qrX, qrY, qrSize, qrSize, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(qrX + qrSize * 0.1, qrY + qrSize * 0.1, qrSize * 0.8, qrSize * 0.8, 'F');
  doc.setFillColor(0, 0, 0);
  doc.rect(qrX + qrSize * 0.2, qrY + qrSize * 0.2, qrSize * 0.25, qrSize * 0.25, 'F');
  doc.rect(qrX + qrSize * 0.55, qrY + qrSize * 0.2, qrSize * 0.25, qrSize * 0.25, 'F');
  doc.rect(qrX + qrSize * 0.2, qrY + qrSize * 0.55, qrSize * 0.25, qrSize * 0.25, 'F');
  doc.rect(qrX + qrSize * 0.4, qrY + qrSize * 0.4, qrSize * 0.2, qrSize * 0.2, 'F');

  // Barcode lines
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

  // Code string
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  doc.text(codeStr, textX, textY);
}
