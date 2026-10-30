import { lazy, Suspense, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';

const LazyPdfViewer = lazy(async () => {
  const mod = await import('@react-pdf/renderer');
  return {
    default: function FlightPdfViewerInner({
      children,
    }: {
      children: ReactElement;
    }) {
      return (
        <mod.PDFViewer width="100%" height="100%" showToolbar>
          {children}
        </mod.PDFViewer>
      );
    },
  };
});

export function FlightPdfPreview({ document }: { document: ReactElement | null }) {
  if (!document) return null;
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading preview…
        </div>
      }
    >
      <LazyPdfViewer>{document}</LazyPdfViewer>
    </Suspense>
  );
}
