export const BUSINESS_TYPES = [
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'cafe', label: 'Café' },
  { id: 'barbershop', label: 'Barbershop' },
  { id: 'salon', label: 'Salon / beauty studio' },
  { id: 'hotel', label: 'Hotel / hospitality' },
  { id: 'retail_store', label: 'Retail store' },
  { id: 'fashion_store', label: 'Fashion store' },
  { id: 'ecommerce', label: 'Online store / e-commerce' },
  { id: 'grocery', label: 'Grocery / supermarket' },
  { id: 'pharmacy', label: 'Pharmacy' },
  { id: 'gym', label: 'Gym / fitness studio' },
  { id: 'clinic', label: 'Clinic / healthcare' },
  { id: 'dental_clinic', label: 'Dental clinic' },
  { id: 'coaching_center', label: 'Coaching center' },
  { id: 'school', label: 'School / education' },
  { id: 'college_university', label: 'College / university' },
  { id: 'spa_wellness', label: 'Spa / wellness' },
  { id: 'real_estate', label: 'Real estate' },
  { id: 'automotive', label: 'Auto service / dealership' },
  { id: 'professional_services', label: 'Professional services' },
  { id: 'repair_service', label: 'Repair service' },
  { id: 'travel_hospitality', label: 'Travel / tourism' },
  { id: 'event_venue', label: 'Events / venue' },
  { id: 'nonprofit', label: 'Nonprofit / community' },
  { id: 'other', label: 'Other business' },
] as const

export type BusinessType = typeof BUSINESS_TYPES[number]['id']

export function getBusinessTypeLabel(value?: string | null) {
  return BUSINESS_TYPES.find(type => type.id === value)?.label || 'Other business'
}
