export type IndigoDownloadInput = {
  pnr: string;
  lastName: string;
};

function serviceConfig(): { url: string; secret: string } {
  const url = (process.env.INDIGO_FETCH_URL ?? '').replace(/\/+$/, '');
  const secret = process.env.INDIGO_FETCH_SECRET ?? '';
  if (!url || !secret) {
    throw new Error('IndiGo download service is not configured.');
  }
  return { url, secret };
}

/** Ask the Render browser service for the IndiGo itinerary PDF. */
export async function downloadIndigoItinerary(input: IndigoDownloadInput): Promise<Buffer> {
  const { url, secret } = serviceConfig();
  const pnr = input.pnr.trim().toUpperCase();
  const lastName = input.lastName.trim();
  const res = await fetch(`${url}/itinerary`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ pnr, lastName }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text.slice(0, 400);
    try {
      const json = JSON.parse(text) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      // body was not JSON
    }
    throw new Error(message || `IndiGo service failed (${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500 || buf.subarray(0, 4).toString() !== '%PDF') {
    throw new Error('IndiGo service did not return a PDF.');
  }
  return buf;
}
