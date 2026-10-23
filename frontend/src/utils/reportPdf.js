import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function downloadReportPdf({ title, subtitle, filename, columns, rows }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  autoTable(doc, {
    columns,
    body: rows,
    startY: 35,
    margin: { top: 35, right: 12, bottom: 18, left: 12 },
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.7, textColor: [27, 36, 55], lineColor: [221, 226, 238], lineWidth: 0.15, overflow: 'linebreak' },
    headStyles: { fillColor: [11, 31, 77], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, cellPadding: 3.2 },
    alternateRowStyles: { fillColor: [245, 247, 251] },
    tableLineColor: [221, 226, 238],
    tableLineWidth: 0.15,
    didDrawPage: ({ pageNumber }) => {
      doc.setFillColor(11, 31, 77);
      doc.rect(0, 0, pageWidth, 27, 'F');
      doc.setFillColor(212, 160, 23);
      doc.rect(12, 24, 22, 1.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('RUTAZIGURWA MEMBERS', 12, 11);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(title, 12, 19);
      doc.setTextColor(225, 232, 246);
      doc.setFontSize(8);
      doc.text(subtitle, pageWidth - 12, 19, { align: 'right', maxWidth: pageWidth * 0.55 });

      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setDrawColor(221, 226, 238);
      doc.line(12, pageHeight - 12, pageWidth - 12, pageHeight - 12);
      doc.setTextColor(91, 101, 120);
      doc.setFontSize(8);
      doc.text('Confidential · Administrator report', 12, pageHeight - 7);
      doc.text(`Page ${pageNumber}`, pageWidth - 12, pageHeight - 7, { align: 'right' });
    },
  });

  doc.save(filename);
}
