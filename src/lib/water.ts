export interface WaterEntryValue {
  glasses: number;
  bottles: number;
}

export function emptyWaterEntry(): WaterEntryValue {
  return { glasses: 0, bottles: 0 };
}

export function hasWater(log: { water_glasses: number; water_bottles: number } | null | undefined): boolean {
  if (!log) return false;
  return log.water_glasses > 0 || log.water_bottles > 0;
}

export function formatWaterSummary(
  glasses: number,
  bottles: number,
  empty = '—',
): string {
  const parts: string[] = [];
  if (glasses > 0) parts.push(`${glasses} ${glasses === 1 ? 'vaso' : 'vasos'}`);
  if (bottles > 0) parts.push(`${bottles} ${bottles === 1 ? 'botella' : 'botellas'}`);
  return parts.length > 0 ? parts.join(' · ') : empty;
}

export function isWaterEntryValue(value: unknown): value is WaterEntryValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'glasses' in value &&
    'bottles' in value
  );
}
