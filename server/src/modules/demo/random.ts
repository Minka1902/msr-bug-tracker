export const createRandom = (seed: number) => {
  let state = seed >>> 0 || 1;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const chance = (probability: number) => next() < probability;
  const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)]!;
  const weighted = <T extends string>(weights: Record<T, number>) => {
    const entries = Object.entries(weights) as [T, number][];
    let roll = next() * entries.reduce((sum, [, weight]) => sum + weight, 0);
    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return value;
    }
    return entries.at(-1)![0];
  };
  const sample = <T>(items: readonly T[], count: number) => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(next() * (index + 1));
      [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
    }
    return copy.slice(0, count);
  };

  return { next, int, chance, pick, weighted, sample };
};

export type Random = ReturnType<typeof createRandom>;
