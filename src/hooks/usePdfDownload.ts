import { useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useToast } from '@/hooks/use-toast';

type UsePdfDownloadOptions = {
  onPdfCreated?: () => Promise<void> | void;
};

/**
 * Renders a hidden node to PDF with two guarantees:
 *  1. High DPI (scale=3) so text stays sharp.
 *  2. Section-aware pagination — never split a `.pdf-section` element across
 *     pages; if it doesn't fit on the current page, start a new one.
 */
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
      // Wait for fonts to be ready so Turkish glyphs render sharp.
      if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
        try { await (document as any).fonts.ready; } catch { /* ignore */ }
      }

      const container = contentRef.current;
      const sections = Array.from(container.querySelectorAll<HTMLElement>('.pdf-section'));
      const nodesToRender: HTMLElement[] = sections.length > 0 ? sections : [container];

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const contentMaxHeight = pageHeight - margin * 2;

      const scale = 3;
      const canvasCache: Array<{ canvas: HTMLCanvasElement; heightMm: number }> = [];

      for (const node of nodesToRender) {
        const canvas = await html2canvas(node, {
          scale,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: node.scrollWidth,
          onclone: (clonedDocument) => {
            const style = clonedDocument.createElement('style');
            style.textContent = `
              .pdf-render,
              .pdf-render * {
                animation: none !important;
                transition: none !important;
                transform: none !important;
                opacity: 1 !important;
                filter: none !important;
                text-shadow: none !important;
              }

              .pdf-render {
                --background: 0 0% 100%;
                --foreground: 220 25% 10%;
                --card: 0 0% 100%;
                --card-foreground: 220 25% 10%;
                --popover: 0 0% 100%;
                --popover-foreground: 220 25% 10%;
                --primary: 152 60% 34%;
                --primary-foreground: 0 0% 100%;
                --secondary: 220 15% 94%;
                --secondary-foreground: 220 25% 10%;
                --muted: 220 15% 94%;
                --muted-foreground: 220 12% 34%;
                --accent: 152 40% 94%;
                --accent-foreground: 152 60% 26%;
                --destructive: 0 72% 42%;
                --destructive-foreground: 0 0% 100%;
                --border: 220 15% 82%;
                --input: 220 15% 82%;
                --ring: 152 60% 34%;
                --success: 152 60% 34%;
                --success-foreground: 0 0% 100%;
                --warning: 38 92% 42%;
                --warning-foreground: 0 0% 100%;
                background: hsl(var(--background)) !important;
                color: hsl(var(--foreground)) !important;
                font-synthesis: none;
                -webkit-font-smoothing: antialiased;
                text-rendering: geometricPrecision;
              }

              .pdf-render .pdf-section {
                break-inside: avoid;
                page-break-inside: avoid;
              }
            `;
            clonedDocument.head.appendChild(style);
          },
        });
        // Convert canvas dimensions to millimetres at the target print width.
        const heightMm = (canvas.height * contentWidth) / canvas.width;
        canvasCache.push({ canvas, heightMm });
      }

      let cursorY = margin;

      const addImage = (canvas: HTMLCanvasElement, heightMm: number) => {
        const img = canvas.toDataURL('image/png');
        pdf.addImage(img, 'PNG', margin, cursorY, contentWidth, heightMm, undefined, 'FAST');
        cursorY += heightMm + 3;
      };

      const sliceLargeCanvas = (canvas: HTMLCanvasElement, heightMm: number) => {
        // Section is bigger than one page — split it into page-sized chunks
        // by copying vertical slices to a fresh canvas each time (no negative
        // offsets, no blurry edges).
        const availableMm = contentMaxHeight;
        const pxPerMm = canvas.width / contentWidth;
        const sliceHeightPx = Math.floor(availableMm * pxPerMm);
        let offsetPx = 0;

        while (offsetPx < canvas.height) {
          const remainingPx = canvas.height - offsetPx;
          const chunkPx = Math.min(sliceHeightPx, remainingPx);
          const chunkCanvas = document.createElement('canvas');
          chunkCanvas.width = canvas.width;
          chunkCanvas.height = chunkPx;
          const ctx = chunkCanvas.getContext('2d');
          if (!ctx) break;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, chunkCanvas.width, chunkCanvas.height);
          ctx.drawImage(canvas, 0, -offsetPx);
          const chunkHeightMm = (chunkPx * contentWidth) / canvas.width;

          if (cursorY > margin) {
            pdf.addPage();
            cursorY = margin;
          }
          const img = chunkCanvas.toDataURL('image/png');
          pdf.addImage(img, 'PNG', margin, margin, contentWidth, chunkHeightMm, undefined, 'FAST');
          cursorY = margin + chunkHeightMm + 3;
          offsetPx += chunkPx;
        }
      };

      for (const { canvas, heightMm } of canvasCache) {
        if (heightMm > contentMaxHeight) {
          sliceLargeCanvas(canvas, heightMm);
          continue;
        }
        // Does it fit on the current page?
        if (cursorY + heightMm > margin + contentMaxHeight) {
          pdf.addPage();
          cursorY = margin;
        }
        addImage(canvas, heightMm);
      }

      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text(`Sayfa ${i} / ${totalPages}`, pageWidth - 25, pageHeight - 5);
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
