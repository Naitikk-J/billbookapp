import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const FLIGHT_STATUSES = [
  'booked',
  'confirmed',
  'checked_in',
  'boarding',
  'delayed',
  'departed',
  'arrived',
  'cancelled',
  'missed',
] as const;
export type FlightStatus = (typeof FLIGHT_STATUSES)[number];

const passengerSchema = new Schema(
  {
    name: { type: String, default: '' },
    seat: { type: String, default: '' },
    cabin: { type: String, default: '' },
  },
  { _id: false }
);

const flightSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },

    pnr: { type: String, default: '', uppercase: true, trim: true, index: true },
    bookingReference: { type: String, default: '', trim: true },
    airline: { type: String, default: '', trim: true },
    airlineCode: { type: String, default: '', uppercase: true, trim: true },
    flightNumber: { type: String, default: '', uppercase: true, trim: true },

    fromCity: { type: String, default: '', trim: true },
    fromAirport: { type: String, default: '', uppercase: true, trim: true },
    fromTerminal: { type: String, default: '', trim: true },
    toCity: { type: String, default: '', trim: true },
    toAirport: { type: String, default: '', uppercase: true, trim: true },
    toTerminal: { type: String, default: '', trim: true },

    departureAt: { type: Date, default: null, index: true },
    arrivalAt: { type: Date, default: null },
    durationMinutes: { type: Number, default: null },

    passengers: { type: [passengerSchema], default: [] },
    cabinClass: { type: String, default: '', trim: true },

    status: {
      type: String,
      enum: FLIGHT_STATUSES,
      default: 'booked',
      index: true,
    },
    statusNote: { type: String, default: '' },
    position: { type: Number, default: 0 },

    source: {
      type: String,
      enum: ['manual', 'email', 'pdf'],
      default: 'manual',
      index: true,
    },
    sourceRef: { type: String, default: '' },

    emailSubject: { type: String, default: '' },
    emailFrom: { type: String, default: '' },
    emailDate: { type: Date, default: null },
    rawSnippet: { type: String, default: '' },
    lastEmailAt: { type: Date, default: null },

    pdfName: { type: String, default: '' },

    notes: { type: String, default: '' },
    color: { type: String, default: '' },
    tags: { type: [String], default: [] },

    history: {
      type: [
        new Schema(
          {
            at: { type: Date, default: () => new Date() },
            kind: { type: String, default: 'update' },
            message: { type: String, default: '' },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

flightSchema.index({ companyId: 1, status: 1, position: 1 });
flightSchema.index({ companyId: 1, pnr: 1, flightNumber: 1, departureAt: 1 });
flightSchema.index(
  { companyId: 1, sourceRef: 1 },
  { unique: true, partialFilterExpression: { sourceRef: { $type: 'string', $ne: '' } } }
);

export type FlightDoc = HydratedDocument<InferSchemaType<typeof flightSchema>> & {
  _id: Types.ObjectId;
};

export const Flight = model('Flight', flightSchema);
