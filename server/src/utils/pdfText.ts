import pdf from 'pdf-parse';

export async function pdfBufferToText(buffer: Buffer): Promise<string> {
  const result = await pdf(buffer);
  return result.text ?? '';
}

export function decodePdfBase64(base64: string): Buffer {
  const clean = base64.replace(/^data:.*?;base64,/, '').trim();
  return Buffer.from(clean, 'base64');
}

/** Collapse whitespace for regex that expects inline airline e-ticket text. */
export function flattenPdfText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
