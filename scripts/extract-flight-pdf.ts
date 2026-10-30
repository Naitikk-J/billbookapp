#!/usr/bin/env npx tsx
/**
 * Local flight PDF extractor (no Gemini).
 * Usage: npx tsx scripts/extract-flight-pdf.ts path/to/ticket.pdf [another.pdf ...]
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractFromFlightPdfText } from '../server/src/utils/flightPdfExtract';
import { pdfBufferToText } from '../server/src/utils/pdfText';

async function main() {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    console.error('Usage: npx tsx scripts/extract-flight-pdf.ts <file.pdf> [...]');
    process.exit(1);
  }

  for (const p of paths) {
    const abs = resolve(p);
    const buffer = readFileSync(abs);
    const text = await pdfBufferToText(buffer);
    const result = extractFromFlightPdfText(text, abs);
    console.log(JSON.stringify({ file: abs, ...result }, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
