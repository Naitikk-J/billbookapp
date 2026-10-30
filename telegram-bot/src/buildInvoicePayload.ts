import type { NewBillDraft } from './session.js';
import { needsTravelFields } from './templates.js';

export function buildNewInvoiceBody(draft: NewBillDraft, customerId: string) {
  const amount = draft.amount;
  const taxPercent = draft.templateId === 'safarmate-tax' ? 18 : 0;
  const items = [
    {
      description: draft.description || 'Professional services',
      hsnCode: draft.templateId.includes('tax') || draft.templateId.includes('booking') ? '998552' : '',
      quantity: 1,
      unit: 'nos',
      rate: amount,
      taxPercent,
      discountPercent: 0,
    },
  ];

  const travelDetails = needsTravelFields(draft.templateId)
    ? {
        bookingType: draft.bookingType,
        bookingId: draft.bookingId,
        destination: draft.destination,
        travellerName: draft.customerName,
        flight: draft.templateId === 'safarmate-flight-voucher' ? draft.description : '',
        hotel: draft.bookingType === 'hotel' ? draft.description : '',
      }
    : undefined;

  return {
    kind: 'invoice',
    customerId,
    template: draft.templateId,
    currency: 'INR',
    taxMode: taxPercent > 0 ? 'intra' : 'none',
    issueDate: new Date().toISOString(),
    items,
    travelDetails,
    notes: '',
  };
}
