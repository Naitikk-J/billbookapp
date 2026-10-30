import type { SourceObject } from '@react-pdf/types';

/** react-pdf in Node renders PNG buffers more reliably than huge data URLs. */
export function barcodeImageSrc(dataUrl: string): SourceObject {
  if (
    typeof Buffer !== 'undefined' &&
    dataUrl.startsWith('data:image/png;base64,')
  ) {
    return {
      data: Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64'),
      format: 'png',
    };
  }
  return dataUrl;
}
