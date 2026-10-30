import { Customer } from '../models/Customer';
import { Company } from '../models/Company';
import { Invoice } from '../models/Invoice';
import { ApiError } from './ApiError';
import { computeTotals } from './totals';
import { normalizeTemplateId, type InvoiceTemplateId } from '../config/invoiceTemplates';
import { normalizeTravelDetails, validateTravelForTemplate } from './invoiceTravel';
import { invalidateCompanyCache } from './companyCache';
import { companyFilter } from './companyScope';
import type { FlightInvoiceDraft } from './flightInvoiceDraft';

function resolveTemplateId(raw?: string): InvoiceTemplateId {
  const id = normalizeTemplateId(raw ?? 'modern');
  if (!id) throw ApiError.badRequest(`Unknown invoice template: ${raw ?? ''}`);
  return id;
}

function pickDisplayName(...names: Array<string | undefined | null>): string {
  return names
    .map((n) => (n ?? '').trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] ?? '';
}

function matchCustomerId(
  name: string,
  customers: Array<{ _id: unknown; name: string }>
): string | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  const exact = customers.find((c) => c.name.trim().toLowerCase() === n);
  if (exact) return String(exact._id);
  const partial = customers.find(
    (c) =>
      c.name.trim().toLowerCase().includes(n) || n.includes(c.name.trim().toLowerCase())
  );
  return partial ? String(partial._id) : null;
}

async function nextNumber(
  companyId: string,
  kind: 'invoice' | 'quote' | 'proforma' | 'receipt'
): Promise<string> {
  const company = await Company.findById(companyId);
  if (!company) throw ApiError.notFound('Company not found');

  const prefix = kind === 'quote' ? company.quotePrefix : company.invoicePrefix;
  const field = kind === 'quote' ? 'nextQuoteNumber' : 'nextInvoiceNumber';

  const updated = await Company.findByIdAndUpdate(
    companyId,
    { $inc: { [field]: 1 } },
    { new: true }
  );
  const counter = (updated?.get(field) as number) ?? 1;
  const padded = String(counter - 1).padStart(5, '0');
  return `${prefix}${padded}`;
}

export async function saveFlightInvoiceDraft(
  companyId: string,
  draft: FlightInvoiceDraft,
  opts?: { status?: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled' }
) {
  const customers = await Customer.find(companyFilter(companyId))
    .select('_id name phone email city gstNumber panNumber state address country postalCode')
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  const hint = draft.customerHint ?? { name: '', phone: '', email: '', city: '', gstNumber: '' };
  let customerId =
    draft.matchedCustomerId ??
    matchCustomerId(hint.name, customers) ??
    null;

  let customer = customerId
    ? customers.find((c) => String(c._id) === customerId)
    : null;

  const travellerFromDraft = pickDisplayName(
    typeof draft.travelDetails?.travellerName === 'string'
      ? draft.travelDetails.travellerName
      : '',
    hint.name
  );

  if (!customer) {
    const name = travellerFromDraft || 'Flight customer';
    customer = await Customer.create({
      companyId,
      name,
      phone: hint.phone ?? '',
      email: hint.email ?? '',
      city: hint.city ?? '',
      gstNumber: hint.gstNumber ?? '',
      kind: 'customer',
    });
    customerId = String(customer._id);
  } else {
    customerId = String(customer._id);
    const bestName = pickDisplayName(travellerFromDraft, customer.name);
    if (bestName && bestName.length > customer.name.trim().length) {
      await Customer.updateOne({ _id: customer._id }, { $set: { name: bestName } });
      customer = { ...customer, name: bestName };
    }
  }

  const templateId = resolveTemplateId(draft.template);
  const travelInput = {
    ...draft.travelDetails,
    flightSegments: draft.segments ?? draft.travelDetails?.flightSegments,
    startDate: draft.travelDetails?.startDate
      ? new Date(String(draft.travelDetails.startDate)).toISOString()
      : undefined,
    endDate: draft.travelDetails?.endDate
      ? new Date(String(draft.travelDetails.endDate)).toISOString()
      : undefined,
  };

  const snapshotName = pickDisplayName(travellerFromDraft, customer.name);
  const customerCtx = {
    name: snapshotName,
    state: customer.state,
    gstNumber: customer.gstNumber,
    panNumber: customer.panNumber,
  };
  const travelDetails = normalizeTravelDetails(templateId, travelInput, customerCtx);
  const travelError = validateTravelForTemplate(templateId, travelDetails);
  if (travelError) throw ApiError.badRequest(travelError);

  const totals = computeTotals(draft.items, draft.taxMode === 'none' ? 'none' : 'intra');
  const number = await nextNumber(companyId, draft.kind ?? 'invoice');

  const invoice = await Invoice.create({
    companyId,
    customerId: customer._id,
    kind: draft.kind ?? 'invoice',
    number,
    issueDate: new Date(),
    currency: draft.currency || 'INR',
    template: templateId,
    customerSnapshot: {
      name: snapshotName,
      email: customer.email,
      phone: customer.phone,
      gstNumber: customer.gstNumber,
      panNumber: customer.panNumber,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      country: customer.country,
      postalCode: customer.postalCode,
    },
    items: totals.items,
    travelDetails,
    notes: draft.notes ?? '',
    terms: '',
    taxMode: draft.taxMode === 'none' ? 'none' : 'intra',
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    cgstTotal: totals.cgstTotal,
    sgstTotal: totals.sgstTotal,
    igstTotal: totals.igstTotal,
    grandTotal: totals.grandTotal,
    amountPaid: 0,
    balanceDue: totals.grandTotal,
    status: opts?.status ?? 'sent',
    tags: [],
  });

  invalidateCompanyCache(companyId);
  return invoice.toObject();
}
