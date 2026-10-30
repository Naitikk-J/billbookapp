import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

const lineItemSchema = new Schema(
  {
    description: { type: String, required: true, trim: true },
    hsnCode: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 0, default: 1 },
    unit: { type: String, default: 'pax' },
    rate: { type: Number, required: true, min: 0, default: 0 },
    taxPercent: { type: Number, default: 0, min: 0, max: 100 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const travelDetailsSchema = new Schema(
  {
    packageName: { type: String, default: '' },
    destination: { type: String, default: '' },
    startDate: { type: Date },
    endDate: { type: Date },
    adults: { type: Number, default: 0 },
    children: { type: Number, default: 0 },
    hotel: { type: String, default: '' },
    flight: { type: String, default: '' },
    vehicle: { type: String, default: '' },
    notes: { type: String, default: '' },
    bookingId: { type: String, default: '' },
    hotelCity: { type: String, default: '' },
    travellerName: { type: String, default: '' },
    travellerPan: { type: String, default: '', uppercase: true, trim: true },
    panHolderName: { type: String, default: '' },
    advancedReceiptVoucherNo: { type: String, default: '' },
    placeOfSupply: { type: String, default: '' },
    transactionalCategory: { type: String, default: '' },
    transactionalDetails: { type: String, default: 'RG' },
    serviceDescription: { type: String, default: '' },
  },
  { _id: false }
);

const paymentSchema = new Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, default: () => new Date() },
    method: {
      type: String,
      enum: ['upi', 'bank_transfer', 'cash', 'cheque', 'credit_card', 'debit_card', 'other'],
      default: 'upi',
    },
    reference: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  { _id: true, timestamps: true }
);

const invoiceSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    kind: { type: String, enum: ['invoice', 'quote', 'proforma', 'receipt'], default: 'invoice' },
    number: { type: String, required: true, index: true },
    issueDate: { type: Date, required: true, default: () => new Date() },
    dueDate: { type: Date },
    currency: { type: String, default: 'INR' },
    template: { type: String, default: 'heritage' },

    customerSnapshot: {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      gstNumber: { type: String, default: '' },
      panNumber: { type: String, default: '', uppercase: true, trim: true },
      address: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      country: { type: String, default: '' },
      postalCode: { type: String, default: '' },
    },

    items: { type: [lineItemSchema], default: [] },
    travelDetails: { type: travelDetailsSchema, default: () => ({}) },

    notes: { type: String, default: '' },
    terms: { type: String, default: '' },

    subtotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    cgstTotal: { type: Number, default: 0 },
    sgstTotal: { type: Number, default: 0 },
    igstTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },

    taxMode: { type: String, enum: ['intra', 'inter', 'none'], default: 'intra' },
    status: {
      type: String,
      enum: ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'],
      default: 'draft',
      index: true,
    },
    payments: { type: [paymentSchema], default: [] },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

invoiceSchema.index({ companyId: 1, number: 1 }, { unique: true });
invoiceSchema.index({ companyId: 1, issueDate: -1 });

export type InvoiceDoc = HydratedDocument<InferSchemaType<typeof invoiceSchema>> & {
  _id: Types.ObjectId;
};

export const Invoice = model('Invoice', invoiceSchema);
