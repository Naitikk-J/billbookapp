import { chromium } from 'playwright';

const EDIT_BOOKING_URL = 'https://www.goindigo.in/edit-booking.html';

let queue = Promise.resolve();

async function dismissCookie(page) {
  const essential = page.getByRole('button', { name: /Accept Essential Only/i });
  const close = page.getByRole('button', { name: /Close banner/i });
  try {
    if (await essential.isVisible({ timeout: 2500 })) {
      await essential.click({ timeout: 2000 });
      return;
    }
  } catch {
    // banner already gone
  }
  try {
    if (await close.isVisible({ timeout: 1000 })) await close.click({ timeout: 2000 });
  } catch {
    // no banner
  }
}

async function readPrintHtml(page) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const html = await page.evaluate(() => {
      const hooked = window.__indigoPrintHtml || '';
      if (hooked.length > 800) return hooked;
      const frames = document.querySelectorAll('iframe');
      for (const frame of frames) {
        const doc = frame.contentDocument;
        const inner = doc && doc.documentElement ? doc.documentElement.outerHTML : '';
        if (inner.length > 2000) return inner;
      }
      return '';
    });
    if (html.length > 800) return html;
    await page.waitForTimeout(400);
  }
  return '';
}

async function pdfFromHtml(context, html) {
  const printPage = await context.newPage();
  const doc = html.includes('<base ')
    ? html
    : html.replace(/<head[^>]*>/i, '$&<base href="https://www.goindigo.in/book/itinerary.html">');
  await printPage.setContent(doc, { waitUntil: 'load', timeout: 30_000 });
  const session = await context.newCDPSession(printPage);
  const { data } = await session.send('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true,
    paperWidth: 8.27,
    paperHeight: 11.69,
    marginTop: 0.4,
    marginBottom: 0.4,
    marginLeft: 0.4,
    marginRight: 0.4,
  });
  const buf = Buffer.from(data, 'base64');
  if (buf.length < 500 || buf.subarray(0, 4).toString() !== '%PDF') {
    throw new Error('IndiGo Download did not produce a PDF.');
  }
  return buf;
}

async function fetchPdf({ pnr, lastName }) {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  });
  await context.addInitScript(() => {
    const target = window.top || window;
    window.print = () => {
      const html = document.documentElement ? document.documentElement.outerHTML : '';
      if (html.length > 800) target.__indigoPrintHtml = html;
    };
  });
  const page = await context.newPage();

  try {
    await page.goto(EDIT_BOOKING_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await dismissCookie(page);

    const pnrField = page.locator('input[name="pnr-booking-ref"]');
    const nameField = page.locator('input[name="email-last-name"]');
    await pnrField.waitFor({ state: 'visible', timeout: 30_000 });
    await pnrField.fill(pnr);
    await nameField.fill(lastName);

    const getItinerary = page.getByRole('button', { name: /^Get Itinerary$/i });
    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll('button')].find((el) =>
        /get itinerary/i.test(el.textContent || '')
      );
      return Boolean(button && !button.disabled);
    });
    await getItinerary.click({ timeout: 15_000 });

    await page.waitForURL(/\/book\/itinerary\.html/i, { timeout: 50_000 });
    const download = page.locator('[data-button-code="download"]');
    await download.waitFor({ state: 'visible', timeout: 45_000 });
    await page.waitForTimeout(800);
    await download.click({ timeout: 10_000 });

    const html = await readPrintHtml(page);
    if (html) return await pdfFromHtml(context, html);

    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(600);
    const session = await context.newCDPSession(page);
    const { data } = await session.send('Page.printToPDF', {
      printBackground: true,
      preferCSSPageSize: true,
      paperWidth: 8.27,
      paperHeight: 11.69,
      marginTop: 0.4,
      marginBottom: 0.4,
      marginLeft: 0.4,
      marginRight: 0.4,
    });
    const buf = Buffer.from(data, 'base64');
    if (buf.length < 500 || buf.subarray(0, 4).toString() !== '%PDF') {
      throw new Error('IndiGo Download did not produce a PDF.');
    }
    return buf;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/Timeout/i.test(message)) {
      throw new Error('IndiGo did not open the itinerary. Check the PNR and last name.');
    }
    throw err instanceof Error ? err : new Error(message);
  } finally {
    try {
      if (browser.isConnected()) await browser.close();
    } catch {
      // already closed
    }
  }
}

export function downloadIndigoItinerary(input) {
  const job = queue.then(() => fetchPdf(input));
  queue = job.then(
    () => undefined,
    () => undefined
  );
  return job;
}
