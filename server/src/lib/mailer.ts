import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from './logger';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  sentAt: string;
}

const MAILBOX_LIMIT = 200;
const RESEND_URL = 'https://api.resend.com/emails';

const transport = config.SMTP_URL ? nodemailer.createTransport(config.SMTP_URL) : null;

export const mailbox: MailMessage[] = [];

export const clearMailbox = () => {
  mailbox.length = 0;
};

const sendWithResend = async (apiKey: string, to: string, subject: string, text: string) => {
  const response = await fetch(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.MAIL_FROM, to, subject, text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Resend responded ${response.status}: ${await response.text()}`);
};

export const sendMail = async (to: string, subject: string, text: string) => {
  if (config.RESEND_API_KEY) return sendWithResend(config.RESEND_API_KEY, to, subject, text);
  if (transport) {
    await transport.sendMail({ from: config.MAIL_FROM, to, subject, text });
    return;
  }
  if (config.isProd) throw new Error('No email provider is configured: set RESEND_API_KEY or SMTP_URL');
  if (config.devMailbox) {
    mailbox.push({ to, subject, text, sentAt: new Date().toISOString() });
    if (mailbox.length > MAILBOX_LIMIT) mailbox.shift();
  }
  logger.info({ to, subject, text }, 'Mail (no SMTP configured)');
};

export const appLink = (path: string, token: string) => `${config.APP_URL}${path}?token=${token}`;
