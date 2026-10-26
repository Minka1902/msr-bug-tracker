import { z } from 'zod';
import { CONNECTOR_SCOPES } from '../enums';

const request = z.string().min(1).max(8000);

export const connectorRequestSchema = z.object({ request });
export const connectorDecisionSchema = z.object({
  request,
  approve: z.boolean(),
  scopes: z.array(z.enum(CONNECTOR_SCOPES)).min(1).max(CONNECTOR_SCOPES.length).default(['read']),
});
