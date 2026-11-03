import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startGateway } from '../src/modules/bots/discord/gateway';

class FakeSocket extends EventTarget {
  static instances: FakeSocket[] = [];
  sent: { op: number; d: unknown }[] = [];
  closedWith: number | null = null;

  constructor(readonly url: string) {
    super();
    FakeSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }

  close(code = 1000) {
    this.closedWith = code;
    this.dispatchEvent(Object.assign(new Event('close'), { code, reason: '' }));
  }

  receive(payload: Record<string, unknown>) {
    this.dispatchEvent(Object.assign(new Event('message'), { data: JSON.stringify(payload) }));
  }
}

const latest = () => FakeSocket.instances.at(-1)!;
const hello = () => latest().receive({ op: 10, d: { heartbeat_interval: 1000 } });

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Discord gateway', () => {
  it('identifies, beats, resumes after a zombie connection and re-identifies after an invalid session', () => {
    const onMessage = vi.fn();
    const onReady = vi.fn();
    const gateway = startGateway({
      token: 'token',
      onMessage,
      onReady,
      WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
      random: () => 0.5,
    });
    expect(latest().url).toBe('wss://gateway.discord.gg/?v=10&encoding=json');
    hello();
    expect(latest().sent[0]).toMatchObject({ op: 2, d: { token: 'token', intents: 37377 } });
    vi.advanceTimersByTime(500);
    expect(latest().sent[1]).toEqual({ op: 1, d: null });

    latest().receive({
      op: 0,
      s: 1,
      t: 'READY',
      d: {
        session_id: 'session',
        resume_gateway_url: 'wss://resume.discord.gg',
        user: { id: 'bot', username: 'msr' },
      },
    });
    expect(onReady).toHaveBeenCalledWith({ id: 'bot', username: 'msr' });
    latest().receive({ op: 0, s: 2, t: 'MESSAGE_CREATE', d: { content: 'apples' } });
    expect(onMessage).toHaveBeenCalledWith({ content: 'apples' });

    latest().receive({ op: 11, d: null });
    vi.advanceTimersByTime(1000);
    expect(latest().sent.at(-1)).toEqual({ op: 1, d: 2 });
    vi.advanceTimersByTime(1000);
    expect(latest().closedWith).toBe(4000);

    vi.advanceTimersByTime(750);
    expect(FakeSocket.instances).toHaveLength(2);
    expect(latest().url).toBe('wss://resume.discord.gg/?v=10&encoding=json');
    hello();
    expect(latest().sent[0]).toEqual({ op: 6, d: { token: 'token', session_id: 'session', seq: 2 } });

    latest().receive({ op: 9, d: false });
    vi.advanceTimersByTime(1500);
    expect(FakeSocket.instances).toHaveLength(3);
    expect(latest().url).toBe('wss://gateway.discord.gg/?v=10&encoding=json');
    hello();
    expect(latest().sent[0]).toMatchObject({ op: 2 });
    gateway.stop();
  });

  it('stops for good on a fatal close code and when stopped', () => {
    const gateway = startGateway({
      token: 'token',
      onMessage: vi.fn(),
      WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
    });
    latest().close(4014);
    vi.advanceTimersByTime(120_000);
    expect(FakeSocket.instances).toHaveLength(1);

    const other = startGateway({
      token: 'token',
      onMessage: vi.fn(),
      WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
    });
    other.stop();
    vi.advanceTimersByTime(120_000);
    expect(FakeSocket.instances).toHaveLength(2);
    gateway.stop();
  });
});
