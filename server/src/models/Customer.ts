import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

const customerSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    email: { type: String, lowercase: true, trim: true, default: '' },
    phone: { type: String, default: '' },
    gstNumber: { type: String, default: '', uppercase: true, trim: true },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: 'India' },
    postalCode: { type: String, default: '' },
    notes: { type: String, default: '' },
    tags: { type: [String], default: [] },
    kind: {
      type: String,
      enum: ['customer', 'supplier'],
      default: 'customer',
      index: true,
    },
    openingBalance: { type: Number, default: 0 },
    lastReminderAt: { type: Date, default: null },
  },
  { timestamps: true }
);

customerSchema.index({ companyId: 1, name: 1 });
customerSchema.index({ companyId: 1, email: 1 });

export type CustomerDoc = HydratedDocument<InferSchemaType<typeof customerSchema>> & {
  _id: Types.ObjectId;
};

export const Customer = model('Customer', customerSchema);
