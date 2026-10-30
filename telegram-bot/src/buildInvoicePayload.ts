import type { NewBillDraft } from './session.js';

function isoOrUndefined(value: string): string | undefined {
  const v = value.trim();
  return v ? v : undefined;
}

export function buildNewInvoiceBody(draft: NewBillDraft, customerId: string) {
  const items =
    draft.items.length > 0
      ? draft.items
      : [
          {
            description: draft.description || 'Professional services',
            hsnCode: '',
            quantity: 1,
            unit: 'pax',
            rate: draft.amount,
            taxPercent: draft.taxMode === 'none' ? 0 : 18,
            discountPercent: 0,
          },
        ];

  const travelDetails = {
    bookingType: draft.bookingType,
    bookingId: draft.bookingId,
    advancedReceiptVoucherNo: draft.voucherNo,
    packageName: draft.packageName,
    destination: draft.destination,
    startDate: isoOrUndefined(draft.startDate) ?? '',
    endDate: isoOrUndefined(draft.endDate) ?? '',
    adults: draft.adults || 0,
    children: draft.children || 0,
    hotel: draft.hotel,
    hotelCity: draft.hotelCity,
    flight: draft.flight || (draft.templateId === 'safarmate-flight-voucher' ? draft.description : ''),
    vehicle: draft.vehicle,
    travellerName: draft.travellerName || draft.customerName,
    travellerPan: draft.travellerPan,
    panHolderName: draft.panHolderName,
    placeOfSupply: draft.placeOfSupply,
    transactionalCategory: draft.txnCategory,
    transactionalDetails: draft.txnDetails || (draft.templateId === 'hotel-booking-tax' ? 'RG' : ''),
    serviceDescription: draft.serviceDescription,
  };

  return {
    kind: draft.kind || 'invoice',
    customerId,
    template: draft.templateId,
    currency: 'INR',
    taxMode: draft.taxMode,
    status: 'sent',
    issueDate: draft.issueDate || new Date().toISOString(),
    dueDate: isoOrUndefined(draft.dueDate),
    items,
    travelDetails,
    notes: draft.notes,
    terms: draft.terms,
  };
}
