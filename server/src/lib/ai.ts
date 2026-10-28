import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { AI_PROVIDER_META, type AiProvider } from '@msr/shared/enums';
import { z } from 'zod';
import { HttpError, badGateway, badRequest } from './httpError';

interface GenerateOptions<T> {
  provider: AiProvider;
  apiKey: string;
  name: string;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
}

const TIMEOUT_MS = 90_000;
const MAX_TOKENS = 16_000;
const ERROR_TEXT_MAX = 200;

export const AI_MODELS: Record<AiProvider, string> = {
  anthropic: 'claude-opus-5-5',
  openai: 'gpt-5',
  google: 'gemini-flash-latest',
  xai: 'grok-4-latest',
};

const CHAT_COMPLETIONS: Partial<Record<AiProvider, string>> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  xai: 'https://api.x.ai/v1/chat/completions',
};

const keyRejected = (provider: AiProvider) =>
  badRequest(`Your ${AI_PROVIDER_META[provider].label} key was rejected — update it in Settings → AI`);

const timedOut = (provider: AiProvider) =>
  new HttpError(504, `${AI_PROVIDER_META[provider].label} took too long to answer. Try again.`);

const unexpected = (provider: AiProvider) =>
  badGateway(`${AI_PROVIDER_META[provider].label} answered in an unexpected format. Try again.`);

const jsonSchemaOf = (schema: z.ZodType) => {
  const { $schema: _, ...rest } = z.toJSONSchema(schema);
  return rest;
};

const parseAnswer = <T>(provider: AiProvider, text: string | undefined, schema: z.ZodType<T>) => {
  try {
    const parsed = schema.safeParse(JSON.parse(text ?? ''));
    if (parsed.success) return parsed.data;
  } catch {
    /* falls through to the format error */
  }
  throw unexpected(provider);
};

const failed = async (provider: AiProvider, response: Response) => {
  if (response.status === 401 || response.status === 403) return keyRejected(provider);
  if (response.status === 429)
    return new HttpError(
      429,
      `${AI_PROVIDER_META[provider].label} is busy or your quota is used up. Try again later.`,
    );
  const body = await response.text().catch(() => '');
  return badGateway(
    `${AI_PROVIDER_META[provider].label} answered: ${body.slice(0, ERROR_TEXT_MAX) || response.status}`,
  );
};

const post = async (provider: AiProvider, url: string, headers: Record<string, string>, body: unknown) => {
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') throw timedOut(provider);
    throw badGateway(`We couldn't reach ${AI_PROVIDER_META[provider].vendor}. Try again shortly.`);
  }
};

const viaClaude = async <T>({ apiKey, system, prompt, schema, maxTokens }: GenerateOptions<T>) => {
  try {
    const response = await new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 }).beta.messages.parse({
      model: AI_MODELS.anthropic,
      max_tokens: maxTokens ?? MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: prompt }],
      output_config: { effort: 'medium', format: betaZodOutputFormat(schema) },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    if (response.stop_reason === 'refusal')
      throw badGateway('Claude declined to answer this. Try rewording it.');
    if (!response.parsed_output) throw unexpected('anthropic');
    return response.parsed_output as T;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError)
      throw keyRejected('anthropic');
    if (error instanceof Anthropic.APIConnectionTimeoutError) throw timedOut('anthropic');
    if (error instanceof Anthropic.RateLimitError)
      throw new HttpError(429, 'Claude is busy or your quota is used up. Try again later.');
    if (error instanceof Anthropic.APIError)
      throw badGateway(`Claude answered: ${error.message.slice(0, ERROR_TEXT_MAX)}`);
    throw error;
  }
};

const viaChatCompletions = async <T>({
  provider,
  apiKey,
  name,
  system,
  prompt,
  schema,
}: GenerateOptions<T>) => {
  const response = await post(
    provider,
    CHAT_COMPLETIONS[provider]!,
    { Authorization: `Bearer ${apiKey}` },
    {
      model: AI_MODELS[provider],
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name, strict: true, schema: jsonSchemaOf(schema) },
      },
    },
  );
  if (!response.ok) throw await failed(provider, response);
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return parseAnswer(provider, data.choices?.[0]?.message?.content, schema);
};

const viaGemini = async <T>({ apiKey, system, prompt, schema, maxTokens }: GenerateOptions<T>) => {
  const response = await post(
    'google',
    `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODELS.google}:generateContent`,
    { 'x-goog-api-key': apiKey },
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: jsonSchemaOf(schema),
        maxOutputTokens: maxTokens ?? MAX_TOKENS,
      },
    },
  );
  if (!response.ok) throw await failed('google', response);
  const data = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return parseAnswer(
    'google',
    data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join(''),
    schema,
  );
};

export const generateJson = <T>(options: GenerateOptions<T>): Promise<T> =>
  options.provider === 'anthropic'
    ? viaClaude(options)
    : options.provider === 'google'
      ? viaGemini(options)
      : viaChatCompletions(options);
