export const PLACE_CATEGORIES = [
  'medical',
  'school',
  'shops',
  'food',
  'services',
  'government',
  'family',
  'friends',
  'emergency',
  'other',
] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export const PLACE_CATEGORY_META: Record<PlaceCategory, { label: string; icon: string }> = {
  medical: { label: 'Medical', icon: 'stethoscope' },
  school: { label: 'School & kids', icon: 'school' },
  shops: { label: 'Shops', icon: 'store' },
  food: { label: 'Food & drink', icon: 'utensils' },
  services: { label: 'Services & repairs', icon: 'wrench' },
  government: { label: 'Government', icon: 'landmark' },
  family: { label: 'Family', icon: 'house' },
  friends: { label: 'Friends', icon: 'users' },
  emergency: { label: 'Emergency', icon: 'heart-pulse' },
  other: { label: 'Other', icon: 'map-pin' },
};
