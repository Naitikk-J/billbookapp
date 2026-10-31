import express from 'express';
import { downloadIndigoItinerary } from './download.mjs';

const app = express();
app.use(express.json({ limit: '32kb' }));

function authorized(req) {
  const secret = process.env.INDIGO_FETCH_SECRET || '';
  const header = req.get('authorization') || '';
  return Boolean(secret) && header === `Bearer ${secret}`;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/itinerary', async (req, res) => {
  if (!authorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const pnr = String(req.body?.pnr || '')
    .trim()
    .toUpperCase();
  const lastName = String(req.body?.lastName || '').trim();
  if (!/^[A-Z0-9]{5,8}$/.test(pnr) || lastName.length < 2 || lastName.length > 120) {
    res.status(400).json({ error: 'PNR and last name are required.' });
    return;
  }
  try {
    const pdf = await downloadIndigoItinerary({ pnr, lastName });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="IndiGo-${pnr}.pdf"`);
    res.send(pdf);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Download failed';
    res.status(502).json({ error: message.slice(0, 500) });
  }
});

const port = Number(process.env.PORT || 10000);
app.listen(port, '0.0.0.0', () => {
  console.log(`indigo-fetch listening on ${port}`);
});
