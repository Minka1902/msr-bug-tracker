import type { PlaceCategory } from '@msr/shared/places';
import type { CreatePlaceInput, UpdatePlaceInput } from '@msr/shared/schemas/place';
import type { Place } from '@msr/shared/types';
import { query, queryOne } from '../../db/pool';

interface PlaceRow {
  id: string;
  name: string;
  category: PlaceCategory;
  contact_name: string;
  phone: string;
  phone_alt: string;
  email: string;
  website: string;
  address: string;
  city: string;
  postal_code: string;
  opening_hours: string;
  notes: string;
  is_favorite: boolean;
  updated_at: Date;
}

const COLUMNS = {
  name: 'name',
  category: 'category',
  contactName: 'contact_name',
  phone: 'phone',
  phoneAlt: 'phone_alt',
  email: 'email',
  website: 'website',
  address: 'address',
  city: 'city',
  postalCode: 'postal_code',
  openingHours: 'opening_hours',
  notes: 'notes',
  isFavorite: 'is_favorite',
} as const satisfies Record<keyof UpdatePlaceInput, string>;
const FIELDS = Object.keys(COLUMNS) as (keyof typeof COLUMNS)[];
const DEFAULTS: Omit<Required<CreatePlaceInput>, 'name'> = {
  category: 'other',
  contactName: '',
  phone: '',
  phoneAlt: '',
  email: '',
  website: '',
  address: '',
  city: '',
  postalCode: '',
  openingHours: '',
  notes: '',
  isFavorite: false,
};

const LIST_PLACES =
  'SELECT * FROM household_places WHERE project_id = $1 ORDER BY is_favorite DESC, lower(name), created_at';
const INSERT_PLACE = `
  INSERT INTO household_places (project_id, created_by, ${FIELDS.map((field) => COLUMNS[field]).join(', ')})
  VALUES ($1, $2, ${FIELDS.map((_, index) => `$${index + 3}`).join(', ')})
  RETURNING *`;
const DELETE_PLACE = 'DELETE FROM household_places WHERE id = $1 AND project_id = $2 RETURNING id';

const toPlace = (row: PlaceRow): Place => ({
  id: row.id,
  name: row.name,
  category: row.category,
  contactName: row.contact_name,
  phone: row.phone,
  phoneAlt: row.phone_alt,
  email: row.email,
  website: row.website,
  address: row.address,
  city: row.city,
  postalCode: row.postal_code,
  openingHours: row.opening_hours,
  notes: row.notes,
  isFavorite: row.is_favorite,
  updatedAt: row.updated_at.toISOString(),
});

export const listPlaces = (projectId: string) =>
  query<PlaceRow>(LIST_PLACES, [projectId]).then((rows) => rows.map(toPlace));

export const createPlace = (projectId: string, userId: string, input: CreatePlaceInput) => {
  const values: Required<CreatePlaceInput> = { ...DEFAULTS, ...input };
  return queryOne<PlaceRow>(INSERT_PLACE, [projectId, userId, ...FIELDS.map((field) => values[field])]).then(
    (row) => toPlace(row!),
  );
};

export const updatePlace = (projectId: string, placeId: string, input: UpdatePlaceInput) => {
  const fields = FIELDS.filter((field) => input[field] !== undefined);
  const sets = fields.map((field, index) => `${COLUMNS[field]} = $${index + 3}`).join(', ');
  return queryOne<PlaceRow>(
    `UPDATE household_places SET ${sets}, updated_at = now() WHERE id = $1 AND project_id = $2 RETURNING *`,
    [placeId, projectId, ...fields.map((field) => input[field])],
  ).then((row) => row && toPlace(row));
};

export const deletePlace = (projectId: string, placeId: string) =>
  queryOne(DELETE_PLACE, [placeId, projectId]).then(Boolean);
