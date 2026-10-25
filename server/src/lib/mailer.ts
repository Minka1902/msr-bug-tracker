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

const transport = config.SMTP_URL ? nodemailer.createTransport(config.SMTP_URL) : null;

export const mailbox: MailMessage[] = [];

export const clearMailbox = () => {
  mailbox.length = 0;
};

export const sendMail = async (to: string, subject: string, text: string) => {
  if (transport) {
    await transport.sendMail({ from: config.MAIL_FROM, to, subject, text });
    return;
  }
  if (config.devMailbox) {
    mailbox.push({ to, subject, text, sentAt: new Date().toISOString() });
    if (mailbox.length > MAILBOX_LIMIT) mailbox.shift();
  }
  logger.info({ to, subject, text }, 'Mail (no SMTP configured)');
};

export const appLink = (path: string, token: string) => `${config.APP_URL}${path}?token=${token}`;
