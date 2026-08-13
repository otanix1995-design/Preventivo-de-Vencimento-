import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ControleVencimento, Produto, FiltroPdfOptions } from '../types';
import { formatarDataBR, formatarMoeda, calcularDiasAteVencimento } from './date';

export interface ItemRelatorioPdf {
  controle: ControleVencimento;
  produto: Produto;
}

export function gerarRelatorioPdf(
  items: ItemRelatorioPdf[],
  filtros: FiltroPdfOptions
) {
  // Create jsPDF in landscape mode
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const todayDateBR = new Date().toLocaleDateString('pt-BR');

  // Header options with fallback defaults matching requested reference layout
  const dataHeaderStr = filtros.dataCabecalho?.trim() || todayDateBR;
  const tituloStr = filtros.tituloRelatorio?.trim().toUpperCase() || 'PREVENTIVO SETOR FRIOS';
  const liderStr = filtros.liderResponsavel?.trim().toUpperCase() || 'LIDER JOAO';

  // Ensure sorting by nearest expiration date first
  const sortedItems = [...items].sort((a, b) => {
    if (filtros.ordenacao === 'DATA_VENCIMENTO' || !filtros.ordenacao) {
      const cmp = a.controle.dataVencimento.localeCompare(b.controle.dataVencimento);
      if (cmp !== 0) return cmp;
      return (a.controle.codigo || '').localeCompare(b.controle.codigo || '');
    }
    return 0;
  });

  // 1. Draw Orange Header Banner (Matching reference image)
  const bannerX = 10;
  const bannerY = 10;
  const bannerWidth = 277; // 297 - 20mm margins
  const bannerHeight = 12;

  // Background Orange Fill #ED7D31 / rgb(232, 119, 34)
  doc.setFillColor(232, 119, 34);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(bannerX, bannerY, bannerWidth, bannerHeight, 'FD');

  // Banner Texts (White, Bold)
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');

  // Left: Date
  doc.setFontSize(11);
  doc.text(dataHeaderStr, bannerX + 4, bannerY + 8);

  // Center: Title
  doc.setFontSize(13);
  doc.text(tituloStr, pageWidth / 2, bannerY + 8, { align: 'center' });

  // Right: Leader Name
  doc.setFontSize(11);
  doc.text(liderStr, bannerX + bannerWidth - 4, bannerY + 8, { align: 'right' });

  // 2. Map data to table rows
  const tableData = sortedItems.map((item) => {
    const p = item.produto;
    const c = item.controle;

    const precoFmt =
      c.precoTrabalhado !== null && c.precoTrabalhado !== undefined
        ? formatarMoeda(c.precoTrabalhado)
        : '-';

    const dataVencFmt = formatarDataBR(c.dataVencimento);
    const daysRemaining = calcularDiasAteVencimento(c.dataVencimento);

    // Get quantity for EMB1 and EMB9
    const emb1Val =
      c.qtdEmb1 !== undefined && c.qtdEmb1 !== null
        ? String(c.qtdEmb1)
        : p?.estoqueEmb1 || '-';

    const emb9Val =
      c.qtdEmb9 !== undefined && c.qtdEmb9 !== null
        ? String(c.qtdEmb9)
        : p?.estoqueEmb9 || '-';

    return [
      p?.codigo || c.codigo || '-',
      p?.dig || c.dig || '-',
      p?.descricao || '-',
      p?.embalagem || '-',
      p?.compradorFilial || '-',
      emb1Val,
      emb9Val,
      { content: dataVencFmt, daysRemaining, status: c.status },
      precoFmt,
    ];
  });

  // 3. Render Table using autoTable with yellow headers & grid borders
  autoTable(doc, {
    startY: bannerY + bannerHeight, // 22mm
    margin: { left: 10, right: 10 },
    head: [
      [
        'CÓDIGO',
        'DIG',
        'DESCRIÇÃO MERCADORIA',
        'EMBALAGEM',
        'COMPRADOR',
        'EMB1',
        'EMB9',
        'VENCIMENTO',
        'PRECO',
      ],
    ],
    body: tableData as any,
    theme: 'grid',
    tableLineWidth: 0.2,
    tableLineColor: [0, 0, 0],
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
      valign: 'middle',
      font: 'helvetica',
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [255, 255, 0], // Bright Yellow #FFFF00
      textColor: [0, 0, 0],      // Black Text
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 9,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },  // CÓDIGO
      1: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },  // DIG
      2: { cellWidth: 80, halign: 'left' },                       // DESCRIÇÃO
      3: { cellWidth: 35, halign: 'left' },                       // EMBALAGEM
      4: { cellWidth: 45, halign: 'left' },                       // COMPRADOR
      5: { cellWidth: 14, halign: 'center' },                     // EMB1
      6: { cellWidth: 14, halign: 'center' },                     // EMB9
      7: { cellWidth: 28, halign: 'center' },                     // VENCIMENTO
      8: { cellWidth: 31, halign: 'center', fontStyle: 'bold' },  // PRECO
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        // CÓDIGO and DIG bold font
        if (data.column.index === 0 || data.column.index === 1) {
          data.cell.styles.fontStyle = 'bold';
        }

        // PRECO column formatting & high visibility
        if (data.column.index === 8) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 9;
          data.cell.styles.halign = 'center';
          data.cell.styles.textColor = [0, 0, 0];
        }

        // VENCIMENTO column custom cell styling (Red or Purple background with white bold text)
        if (data.column.index === 7) {
          const cellRaw = data.cell.raw as any;
          const days = typeof cellRaw === 'object' && cellRaw ? cellRaw.daysRemaining : 0;
          const textVal = typeof cellRaw === 'object' && cellRaw ? cellRaw.content : String(cellRaw);

          data.cell.text = [textVal];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.halign = 'center';

          if (days >= 4 && days <= 10) {
            // Purple highlight (#7030A0) for ~1 week window
            data.cell.styles.fillColor = [112, 48, 160];
          } else {
            // Bright Red (#FF0000) for urgent / expired / distant window
            data.cell.styles.fillColor = [255, 0, 0];
          }
        }
      }
    },
    didDrawPage: (data) => {
      // Footer with page numbering
      const totalPages = (doc as any).internal.getNumberOfPages();
      const pageCurrent = data.pageNumber;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Página ${pageCurrent} de ${totalPages} — Preventivo Setor Frios`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 6,
        { align: 'center' }
      );
    },
  });

  // Save PDF
  const dataArquivo = new Date().toISOString().slice(0, 10);
  doc.save(`Preventivo_Vencimentos_${dataArquivo}.pdf`);
}

