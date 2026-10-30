import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

const ledgerEntrySchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    kind: {
      type: String,
      enum: ['payment', 'credit'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, default: '' },
    method: {
      type: String,
      enum: ['cash', 'upi', 'bank', 'card', 'cheque', 'other'],
      default: 'cash',
    },
    date: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: true }
);

ledgerEntrySchema.index({ companyId: 1, customerId: 1, date: -1 });
ledgerEntrySchema.index({ companyId: 1, date: -1 });
ledgerEntrySchema.index({ companyId: 1, customerId: 1, kind: 1 });

export type LedgerEntryDoc = HydratedDocument<InferSchemaType<typeof ledgerEntrySchema>> & {
  _id: Types.ObjectId;
};

export const LedgerEntry = model('LedgerEntry', ledgerEntrySchema);
