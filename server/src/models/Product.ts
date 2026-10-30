import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

const productSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    kind: { type: String, enum: ['product', 'service'], default: 'service' },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '' },
    category: { type: String, default: '' },
    unit: { type: String, default: 'pax' },
    price: { type: Number, required: true, min: 0, default: 0 },
    taxPercent: { type: Number, default: 18, min: 0, max: 100 },
    hsnCode: { type: String, default: '' },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

productSchema.index({ companyId: 1, name: 1 });
productSchema.index({ companyId: 1, isArchived: 1, createdAt: -1 });

export type ProductDoc = HydratedDocument<InferSchemaType<typeof productSchema>> & {
  _id: Types.ObjectId;
};

export const Product = model('Product', productSchema);
