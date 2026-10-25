export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

const OFFLINE_MESSAGE = "You're offline or the server can't be reached";

type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

export const toSearch = (query: Query = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0))
      continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const search = params.toString();
  return search ? `?${search}` : '';
};

export const api = async <T = void>(
  path: string,
  { method = 'GET', body, query, signal }: RequestOptions = {},
): Promise<T> => {
  const isForm = body instanceof FormData;
  const response = await fetch(`/api${path}${toSearch(query)}`, {
    method,
    signal,
    credentials: 'same-origin',
    headers: body === undefined || isForm ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  }).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, OFFLINE_MESSAGE);
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data.error ?? response.statusText, data.details);
  return data as T;
};

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong';

export const isNetworkError = (error: unknown) => error instanceof ApiError && error.status === 0;
