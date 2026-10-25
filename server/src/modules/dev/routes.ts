import { Router } from 'express';
import { mailbox } from '../../lib/mailer';

export const createDevRouter = () => {
  const router = Router();

  router.get('/mailbox', (req, res) => {
    const to = String(req.query.to ?? '').toLowerCase();
    res.json({ messages: mailbox.filter((mail) => !to || mail.to === to).reverse() });
  });

  return router;
};
