import { z } from 'zod';
import { NAV_LAYOUTS, THEME_MODES, THEME_STYLES } from '../enums';

const isTimezone = (value: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email'))
  .pipe(z.string().max(254));
export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Use at most 128 characters');
export const nameSchema = z.string().trim().min(1, 'Name is required').max(80);
export const timezoneSchema = z.string().max(64).refine(isTimezone, 'Unknown timezone');
export const tokenSchema = z.string().min(20).max(200);

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  timezone: timezoneSchema.optional(),
});

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: tokenSchema, password: passwordSchema });
export const verifyEmailSchema = z.object({ token: tokenSchema });

export const preferencesSchema = z
  .object({
    style: z.enum(THEME_STYLES),
    mode: z.enum(THEME_MODES),
    nav: z.enum(NAV_LAYOUTS),
    timezone: timezoneSchema,
  })
  .partial()
  .strict();

export const updateMeSchema = z.object({
  name: nameSchema.optional(),
  preferences: preferencesSchema.optional(),
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
export const changeEmailSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
