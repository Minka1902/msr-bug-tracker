import type { Response } from 'express';
import { config } from '../config';

export const SESSION_COOKIE = config.isProd ? '__Host-sid' : 'sid';
export const SESSION_DAYS = 30;

export const setSessionCookie = (res: Response, token: string) =>
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    path: '/',
    maxAge: SESSION_DAYS * 86_400_000,
  });

export const clearSessionCookie = (res: Response) =>
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/' });
