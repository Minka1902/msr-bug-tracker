import { logger } from '../../../lib/logger';

interface Payload {
  op: number;
  d: unknown;
  s?: number | null;
  t?: string | null;
}

interface GatewayOptions<M> {
  token: string;
  onMessage: (message: M) => void;
  onReady?: (user: { id: string; username: string }) => void;
  WebSocketImpl?: typeof WebSocket;
  random?: () => number;
}

const GATEWAY_URL = 'wss://gateway.discord.gg';
const QUERY = '/?v=10&encoding=json';
const INTENTS = (1 << 0) | (1 << 9) | (1 << 12) | (1 << 15);
const FATAL_CODES = new Set([4004, 4010, 4011, 4012, 4013, 4014]);
const FRESH_SESSION_CODES = new Set([4007, 4009]);
const RESUME_CLOSE = 4000;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 60_000;

const OP = {
  dispatch: 0,
  heartbeat: 1,
  identify: 2,
  resume: 6,
  reconnect: 7,
  invalid: 9,
  hello: 10,
  ack: 11,
};

export const startGateway = <M>({
  token,
  onMessage,
  onReady,
  WebSocketImpl = WebSocket,
  random = Math.random,
}: GatewayOptions<M>) => {
  let socket: WebSocket | null = null;
  let heartbeat: ReturnType<typeof setTimeout> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let acked = true;
  let seq: number | null = null;
  let session: { id: string; url: string } | null = null;
  let attempts = 0;
  let stopped = false;

  const send = (op: number, d: unknown) => socket?.send(JSON.stringify({ op, d }));

  const startHeartbeat = (interval: number) => {
    clearTimeout(heartbeat);
    acked = true;
    const tick = () => {
      if (!acked) {
        socket?.close(RESUME_CLOSE);
        return;
      }
      acked = false;
      send(OP.heartbeat, seq);
      heartbeat = setTimeout(tick, interval);
    };
    heartbeat = setTimeout(tick, interval * random());
  };

  const handle = ({ op, d, s, t }: Payload) => {
    if (s !== undefined && s !== null) seq = s;
    if (op === OP.hello) {
      startHeartbeat((d as { heartbeat_interval: number }).heartbeat_interval);
      if (session) send(OP.resume, { token, session_id: session.id, seq });
      else
        send(OP.identify, {
          token,
          intents: INTENTS,
          properties: { os: 'linux', browser: 'msr', device: 'msr' },
        });
    } else if (op === OP.ack) acked = true;
    else if (op === OP.heartbeat) send(OP.heartbeat, seq);
    else if (op === OP.reconnect) socket?.close(RESUME_CLOSE);
    else if (op === OP.invalid) {
      if (!d) session = null;
      socket?.close(RESUME_CLOSE);
    } else if (op === OP.dispatch && t === 'READY') {
      const ready = d as {
        session_id: string;
        resume_gateway_url: string;
        user: { id: string; username: string };
      };
      session = { id: ready.session_id, url: ready.resume_gateway_url };
      attempts = 0;
      logger.info({ bot: ready.user.username }, 'Discord bot connected');
      onReady?.(ready.user);
    } else if (op === OP.dispatch && t === 'RESUMED') attempts = 0;
    else if (op === OP.dispatch && t === 'MESSAGE_CREATE') onMessage(d as M);
  };

  const connect = () => {
    const ws = new WebSocketImpl(`${session?.url ?? GATEWAY_URL}${QUERY}`);
    socket = ws;
    ws.addEventListener('message', (event) => handle(JSON.parse(String(event.data)) as Payload));
    ws.addEventListener('close', (event) => {
      if (socket !== ws) return;
      clearTimeout(heartbeat);
      socket = null;
      if (stopped) return;
      if (FATAL_CODES.has(event.code)) {
        logger.error(
          { code: event.code, reason: event.reason },
          'Discord bot stopped: check DISCORD_BOT_TOKEN and turn on Message Content Intent in the Developer Portal',
        );
        return;
      }
      if (FRESH_SESSION_CODES.has(event.code)) session = null;
      const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempts) * (0.5 + random() / 2);
      attempts += 1;
      retry = setTimeout(connect, delay);
    });
  };

  connect();

  return {
    stop: () => {
      stopped = true;
      clearTimeout(heartbeat);
      clearTimeout(retry);
      socket?.close(1000);
    },
  };
};
