export const BOT_TEMPLATES = [
  { id: 'safarmate-tax', name: 'Safarmate Tax Invoice', category: 'gst' as const },
  { id: 'hotel-booking-tax', name: 'Travel Booking Tax', category: 'hotel' as const },
  { id: 'safarmate-flight-voucher', name: 'Flight Voucher', category: 'flight' as const },
  { id: 'heritage', name: 'Heritage', category: 'general' as const },
  { id: 'modern', name: 'Aurora (Modern)', category: 'general' as const },
  { id: 'classic', name: 'Continental', category: 'general' as const },
  { id: 'travel', name: 'Voyage (Travel)', category: 'general' as const },
];

export function templateById(id: string) {
  return BOT_TEMPLATES.find((t) => t.id === id);
}

export function needsTravelFields(templateId: string): boolean {
  return templateId === 'hotel-booking-tax' || templateId === 'safarmate-flight-voucher';
}
