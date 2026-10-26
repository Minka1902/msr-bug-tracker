import { describe, expect, it } from 'vitest';
import { defaultEmblem, EMBLEM_PATTERNS, fitColors, PATTERN_PARTS } from '../src/emblem';
import { emblemSchema } from '../src/schemas/project';

describe('emblems', () => {
  it('keeps chosen colors and fills new parts when the pattern changes', () => {
    expect(fitColors(['#111111', '#222222', '#333333'], 'bars-2')).toEqual(['#111111', '#222222']);
    expect(fitColors(['#111111'], 'quarters')).toEqual(['#111111', '#ffffff', '#0f172a', '#f59e0b']);
    for (const pattern of EMBLEM_PATTERNS)
      expect(fitColors([], pattern)).toHaveLength(PATTERN_PARTS[pattern]);
  });

  it('accepts a valid flag and checks one color per part', () => {
    const emblem = defaultEmblem('#4f56f0');
    expect(emblemSchema.parse(emblem)).toEqual(emblem);
    expect(emblemSchema.safeParse({ ...emblem, pattern: 'quarters' }).success).toBe(false);
    expect(
      emblemSchema.safeParse({ ...emblem, pattern: 'quarters', colors: fitColors(emblem.colors, 'quarters') })
        .success,
    ).toBe(true);
    expect(emblemSchema.safeParse({ ...emblem, divider: { color: '#000000', width: 4 } }).success).toBe(
      false,
    );
  });
});
