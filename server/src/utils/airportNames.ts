type AirportInfo = { city: string; airport?: string };

const IATA: Record<string, AirportInfo> = {
  DEL: { city: 'Delhi', airport: 'Indira Gandhi International' },
  BOM: { city: 'Mumbai', airport: 'Chhatrapati Shivaji Maharaj International' },
  BLR: { city: 'Bengaluru', airport: 'Kempegowda International' },
  MAA: { city: 'Chennai', airport: 'Chennai International' },
  CCU: { city: 'Kolkata', airport: 'Netaji Subhas Chandra Bose International' },
  HYD: { city: 'Hyderabad', airport: 'Rajiv Gandhi International' },
  AMD: { city: 'Ahmedabad', airport: 'Sardar Vallabhbhai Patel International' },
  JAI: { city: 'Jaipur', airport: 'Jaipur International' },
  LKO: { city: 'Lucknow', airport: 'Chaudhary Charan Singh International' },
  PNQ: { city: 'Pune', airport: 'Pune International' },
  GOI: { city: 'Goa', airport: 'Manohar International' },
  COK: { city: 'Kochi', airport: 'Cochin International' },
  TRV: { city: 'Thiruvananthapuram', airport: 'Trivandrum International' },
  IXC: { city: 'Chandigarh', airport: 'Chandigarh International' },
  GAU: { city: 'Guwahati', airport: 'Lokpriya Gopinath Bordoloi International' },
  PAT: { city: 'Patna', airport: 'Jay Prakash Narayan International' },
  IXB: { city: 'Bagdogra', airport: 'Bagdogra Airport' },
  SXR: { city: 'Srinagar', airport: 'Sheikh ul-Alam International' },
  ATQ: { city: 'Amritsar', airport: 'Sri Guru Ram Dass Jee International' },
  NAG: { city: 'Nagpur', airport: 'Dr. Babasaheb Ambedkar International' },
  BBM: { city: 'Belagavi', airport: 'Belagavi Airport' },
  IXE: { city: 'Mangaluru', airport: 'Mangalore International' },
  VNS: { city: 'Varanasi', airport: 'Lal Bahadur Shastri International' },
  IDR: { city: 'Indore', airport: 'Devi Ahilya Bai Holkar Airport' },
  BHO: { city: 'Bhopal', airport: 'Raja Bhoj Airport' },
  JLR: { city: 'Jabalpur', airport: 'Jabalpur Airport' },
  RPR: { city: 'Raipur', airport: 'Swami Vivekananda Airport' },
  SIN: { city: 'Singapore', airport: 'Changi International' },
  DXB: { city: 'Dubai', airport: 'Dubai International' },
  AUH: { city: 'Abu Dhabi', airport: 'Zayed International' },
  DOH: { city: 'Doha', airport: 'Hamad International' },
  LHR: { city: 'London', airport: 'Heathrow' },
  LGW: { city: 'London', airport: 'Gatwick' },
  BKK: { city: 'Bangkok', airport: 'Suvarnabhumi' },
  KUL: { city: 'Kuala Lumpur', airport: 'Kuala Lumpur International' },
  HKG: { city: 'Hong Kong', airport: 'Hong Kong International' },
  NRT: { city: 'Tokyo', airport: 'Narita International' },
  CDG: { city: 'Paris', airport: 'Charles de Gaulle' },
  FRA: { city: 'Frankfurt', airport: 'Frankfurt Airport' },
  JFK: { city: 'New York', airport: 'John F. Kennedy International' },
  EWR: { city: 'Newark', airport: 'Newark Liberty International' },
};

const INDIAN_STATES: Record<string, string> = {
  AP: 'Andhra Pradesh',
  AR: 'Arunachal Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CG: 'Chhattisgarh',
  GA: 'Goa',
  GJ: 'Gujarat',
  HR: 'Haryana',
  HP: 'Himachal Pradesh',
  JH: 'Jharkhand',
  KA: 'Karnataka',
  KL: 'Kerala',
  MP: 'Madhya Pradesh',
  MH: 'Maharashtra',
  MN: 'Manipur',
  ML: 'Meghalaya',
  MZ: 'Mizoram',
  NL: 'Nagaland',
  OD: 'Odisha',
  OR: 'Odisha',
  PB: 'Punjab',
  RJ: 'Rajasthan',
  SK: 'Sikkim',
  TN: 'Tamil Nadu',
  TS: 'Telangana',
  TG: 'Telangana',
  TR: 'Tripura',
  UP: 'Uttar Pradesh',
  UK: 'Uttarakhand',
  UT: 'Uttarakhand',
  WB: 'West Bengal',
  DL: 'Delhi',
  CH: 'Chandigarh',
  JK: 'Jammu and Kashmir',
  LA: 'Ladakh',
  PY: 'Puducherry',
};

export function cityForIata(code: string): string {
  const c = code.trim().toUpperCase();
  return IATA[c]?.city ?? '';
}

export function expandIndianState(value: string): string {
  const t = value.trim();
  if (!t) return '';
  if (t.length === 2) {
    const full = INDIAN_STATES[t.toUpperCase()];
    if (full) return full;
  }
  return t;
}

/** Prefer full city name; resolve 3-letter IATA when city missing or is just the code. */
export function enrichCityName(city: string | undefined, airportCode: string | undefined): string {
  const code = (airportCode ?? '').trim().toUpperCase();
  const raw = (city ?? '').trim();
  const fromCode = code ? cityForIata(code) : '';

  if (raw && raw.length !== 3) return raw;
  if (raw.length === 3 && raw.toUpperCase() === code && fromCode) return fromCode;
  if (fromCode) return fromCode;
  if (raw.length === 3 && cityForIata(raw.toUpperCase())) return cityForIata(raw.toUpperCase());
  return raw || code;
}

export function formatAirportLine(city: string | undefined, airportCode: string | undefined): string {
  const code = (airportCode ?? '').trim().toUpperCase();
  const cityName = enrichCityName(city, code);
  const info = code ? IATA[code] : undefined;

  if (cityName && info?.airport && code) {
    return `${cityName} · ${info.airport} (${code})`;
  }
  if (cityName && code) return `${cityName} (${code})`;
  return cityName || code || '—';
}

export function formatSectorLabel(
  fromCity: string | undefined,
  fromAirport: string | undefined,
  toCity: string | undefined,
  toAirport: string | undefined
): string {
  const from = formatAirportLine(fromCity, fromAirport);
  const to = formatAirportLine(toCity, toAirport);
  return `${from} – ${to}`;
}
