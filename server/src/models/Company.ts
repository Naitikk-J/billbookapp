import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

const companySchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    legalName: { type: String, trim: true, default: '' },
    industry: { type: String, default: 'Travel & Tourism' },
    email: { type: String, lowercase: true, trim: true, default: '' },
    phone: { type: String, default: '' },
    website: { type: String, default: '' },
    gstNumber: { type: String, default: '', uppercase: true, trim: true },
    panNumber: { type: String, default: '', uppercase: true, trim: true },
    cinNumber: { type: String, default: '', uppercase: true, trim: true },
    contactName: { type: String, default: '', trim: true },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: 'India' },
    postalCode: { type: String, default: '' },
    currency: { type: String, default: 'INR' },
    logoUrl: { type: String, default: '' },
    signatureUrl: { type: String, default: '' },
    stampUrl: { type: String, default: '' },
    bankName: { type: String, default: '' },
    beneficiaryName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    accountType: { type: String, default: '' },
    bankBranch: { type: String, default: '' },
    ifsc: { type: String, default: '' },
    upiId: { type: String, default: '' },
    paymentQrUrl: { type: String, default: '' },
    reminderContactsText: { type: String, default: '' },
    reminderDisclaimer: {
      type: String,
      default:
        'This is a system-generated message. Please ignore if already paid.',
    },
    defaultTerms: {
      type: String,
      default:
        'Payment is due within 7 days. Late payments may incur charges. All disputes subject to local jurisdiction.',
    },
    invoicePrefix: { type: String, default: 'INV-' },
    nextInvoiceNumber: { type: Number, default: 1 },
    quotePrefix: { type: String, default: 'QT-' },
    nextQuoteNumber: { type: Number, default: 1 },
    geminiApiKey: { type: String, default: '' },
    gmailAddress: { type: String, default: '', lowercase: true, trim: true },
    gmailAppPassword: { type: String, default: '' },
    lastFlightSyncAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type CompanyDoc = HydratedDocument<InferSchemaType<typeof companySchema>> & {
  _id: Types.ObjectId;
};

export const Company = model('Company', companySchema);
