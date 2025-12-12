import { useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useToast } from '@/hooks/use-toast';

export function usePdfDownload() {
  const contentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const downloadPdf = useCallback(async () => {
    if (!contentRef.current) {
      toast({
        title: 'Hata',
        description: 'PDF oluşturulamadı',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'PDF Hazırlanıyor',
      description: 'Lütfen bekleyin...',
    });

    try {
      const element = contentRef.current;
      
      // Create canvas from the element
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f8f9fa',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20; // 10mm margin on each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10;
      let page = 1;

      // Add first page
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - 20);

      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        page++;
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - 20);
      }

      // Add page numbers only (no footer text on each page)
      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text(`Sayfa ${i} / ${totalPages}`, pageWidth - 25, pageHeight - 8);
      }

      // Download
      const date = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
      pdf.save(`arsa-analiz-${date}.pdf`);

      toast({
        title: 'PDF İndirildi',
        description: 'Analiz raporu başarıyla indirildi',
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: 'Hata',
        description: 'PDF oluşturulurken bir hata oluştu',
        variant: 'destructive',
      });
    }
  }, [toast]);

  return { contentRef, downloadPdf };
}
