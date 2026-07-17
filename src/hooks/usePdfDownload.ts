import { useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useToast } from '@/hooks/use-toast';

type UsePdfDownloadOptions = {
  onPdfCreated?: () => Promise<void> | void;
};

export function usePdfDownload({ onPdfCreated }: UsePdfDownloadOptions = {}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const downloadPdf = useCallback(async () => {
    if (!contentRef.current) {
      toast({ title: 'Hata', description: 'PDF oluşturulamadı', variant: 'destructive' });
      return false;
    }

    toast({ title: 'PDF Hazırlanıyor', description: 'Lütfen bekleyin...' });

    try {
      const element = contentRef.current;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f8f9fa',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10;

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 20;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - 20;
      }

      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text(`Sayfa ${i} / ${totalPages}`, pageWidth - 25, pageHeight - 8);
      }

      const date = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
      pdf.save(`arsa-analiz-${date}.pdf`);
      await onPdfCreated?.();

      toast({ title: 'PDF İndirildi', description: 'Analiz raporu başarıyla indirildi' });
      return true;
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({ title: 'Hata', description: 'PDF oluşturulurken bir hata oluştu', variant: 'destructive' });
      return false;
    }
  }, [onPdfCreated, toast]);

  return { contentRef, downloadPdf };
}
