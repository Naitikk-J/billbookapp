export const INVOICE_TEMPLATE_IDS = [
  'heritage',
  'modern',
  'classic',
  'travel',
  'safarmate-tax',
  'hotel-booking-tax',
] as const;

export type InvoiceTemplateId = (typeof INVOICE_TEMPLATE_IDS)[number];

export interface InvoiceTemplateMeta {
  id: InvoiceTemplateId;
  name: string;
  description: string;
  category: 'general' | 'gst' | 'hotel';
}

export const INVOICE_TEMPLATES: InvoiceTemplateMeta[] = [
  {
    id: 'heritage',
    name: 'Heritage',
    description: 'Boutique gold-trimmed travel-agency classic.',
    category: 'general',
  },
  {
    id: 'modern',
    name: 'Aurora',
    description: 'Modern, colorful, with calm geometry.',
    category: 'general',
  },
  {
    id: 'classic',
    name: 'Continental',
    description: 'Crisp typography, banker-friendly classic.',
    category: 'general',
  },
  {
    id: 'travel',
    name: 'Voyage',
    description: 'Travel-first hero with destination focus.',
    category: 'general',
  },
  {
    id: 'safarmate-tax',
    name: 'Safarmate Tax Invoice',
    description: 'GST tax invoice with reimbursement and service-charge columns.',
    category: 'gst',
  },
  {
    id: 'hotel-booking-tax',
    name: 'Hotel Booking Tax Invoice',
    description: 'Accommodation tax invoice with booking strip and payment breakup.',
    category: 'hotel',
  },
];

const LEGACY_ALIASES: Record<string, InvoiceTemplateId> = {
  safarmate: 'safarmate-tax',
};

export function normalizeTemplateId(raw: string): InvoiceTemplateId | null {
  const id = LEGACY_ALIASES[raw] ?? raw;
  return INVOICE_TEMPLATE_IDS.includes(id as InvoiceTemplateId)
    ? (id as InvoiceTemplateId)
    : null;
}

export function assertTemplateId(raw: string): InvoiceTemplateId {
  const id = normalizeTemplateId(raw);
  if (!id) {
    throw new Error(`Unknown invoice template: ${raw}`);
  }
  return id;
}
