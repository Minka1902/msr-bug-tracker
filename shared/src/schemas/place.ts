import { z } from 'zod';
import { PLACE_CATEGORIES } from '../places';

const text = (max: number) => z.string().trim().max(max);
const webLink = z.union([
  z.literal(''),
  z.url({ protocol: /^https?$/, error: 'Use a web link (https://…)' }).max(2000),
]);
const email = z.union([z.literal(''), z.email('Use a valid email').max(254)]);

const placeFields = {
  name: text(120).min(1, 'Name the place'),
  category: z.enum(PLACE_CATEGORIES),
  contactName: text(120),
  phone: text(40),
  phoneAlt: text(40),
  email,
  website: webLink,
  address: text(300),
  city: text(80),
  postalCode: text(20),
  openingHours: text(300),
  notes: text(4000),
  isFavorite: z.boolean(),
};

export const createPlaceSchema = z.object(placeFields).partial().required({ name: true }).strict();

export const updatePlaceSchema = z
  .object(placeFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export type CreatePlaceInput = z.infer<typeof createPlaceSchema>;
export type UpdatePlaceInput = z.infer<typeof updatePlaceSchema>;
