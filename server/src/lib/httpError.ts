export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
export const unauthorized = (message = 'Not signed in') => new HttpError(401, message);
export const forbidden = (message = 'You do not have permission to do that', details?: unknown) =>
  new HttpError(403, message, details);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const conflict = (message: string, details?: unknown) => new HttpError(409, message, details);
export const badGateway = (message: string) => new HttpError(502, message);
