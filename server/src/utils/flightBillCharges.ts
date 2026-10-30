export interface FlightBillCharges {
  currency: string;
  grandTotal: number;
  airfare: number;
  taxesAndFees: number;
  serviceFee: number;
  discount: number;
  billToName: string;
  pnr: string;
  bookingId: string;
  issuedDate: string;
}

export function emptyFlightBillCharges(): FlightBillCharges {
  return {
    currency: 'INR',
    grandTotal: 0,
    airfare: 0,
    taxesAndFees: 0,
    serviceFee: 0,
    discount: 0,
    billToName: '',
    pnr: '',
    bookingId: '',
    issuedDate: '',
  };
}
