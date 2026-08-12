import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ControleVencimento, Produto, FiltroPdfOptions } from '../types';
import { formatarDataBR, formatarMoeda, getStatusConfig, getFormattedTimestamp } from './date';
import { formatarQuantidade } from './quantity';

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
  const timestampStr = getFormattedTimestamp();

  // Draw Header Banner
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('RELATÓRIO DE PRODUTOS PRÓXIMOS DO VENCIMENTO', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Gerado em: ${timestampStr} | Total de Itens: ${items.length}`, 14, 18);

  // Filter Sub-header text
  let filterDesc = `Filtros Aplicados: Status: ${filtros.status}`;
  if (filtros.compradorFilial !== 'TODOS') {
    filterDesc += ` | Comprador Filial: ${filtros.compradorFilial}`;
  }
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  doc.text(filterDesc, pageWidth - 14, 18, { align: 'right' });

  // Map data to table rows
  const tableData = items.map((item) => {
    const p = item.produto;
    const c = item.controle;

    const precoFmt = c.precoTrabalhado !== null && c.precoTrabalhado !== undefined
      ? formatarMoeda(c.precoTrabalhado)
      : '-';

    const statusConfig = getStatusConfig(c.status);
    const dataVencFmt = `${formatarDataBR(c.dataVencimento)}\n(${statusConfig.label})`;

    const qtdAtualFmt = formatarQuantidade(c.quantidadeAtual, c.unidadeControle, true);

    return [
      p?.codigo || c.codigo || '-',
      p?.dig || c.dig || '-',
      p?.descricao || '-',
      p?.embalagem || '-',
      p?.compradorFilial || '-',
      p?.estoqueEmb1 || '-',
      p?.estoqueEmb9 || '-',
      dataVencFmt,
      precoFmt,
    ];
  });

  autoTable(doc, {
    startY: 28,
    head: [
      [
        'CÓDIGO',
        'DIG',
        'DESCRIÇÃO MERCADORIA',
        'EMBALAGEM',
        'COMPRADOR FILIAL',
        'ESTOQUE EMB1',
        'ESTOQUE EMB9',
        'DATA VENCIMENTO',
        'PREÇO TRABALHADO',
      ],
    ],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      valign: 'middle',
      font: 'helvetica',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [51, 65, 85], // Slate 700
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center' }, // CÓDIGO
      1: { cellWidth: 14, halign: 'center' }, // DIG
      2: { cellWidth: 'auto' },                // DESCRIÇÃO MERCADORIA
      3: { cellWidth: 32 },                   // EMBALAGEM
      4: { cellWidth: 40 },                   // COMPRADOR FILIAL
      5: { cellWidth: 24, halign: 'right' },  // ESTOQUE EMB1
      6: { cellWidth: 24, halign: 'right' },  // ESTOQUE EMB9
      7: { cellWidth: 32, halign: 'center' }, // DATA VENCIMENTO
      8: { cellWidth: 28, halign: 'right' },  // PREÇO TRABALHADO
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // Slate 50
    },
    didDrawPage: (data) => {
      // Footer with page numbering
      const totalPages = (doc as any).internal.getNumberOfPages();
      const pageCurrent = data.pageNumber;

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Página ${pageCurrent} de ${totalPages} — Controle Inteligente de Vencimentos`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      );
    },
  });

  // Save PDF
  const dataArquivo = new Date().toISOString().slice(0, 10);
  doc.save(`Relatorio_Vencimentos_${dataArquivo}.pdf`);
}
