export const usageScreens = ['home', 'explore', 'venues', 'trips', 'events', 'calendar'] as const;
export type UsageScreen = typeof usageScreens[number];
export type Usage = Partial<Record<UsageScreen, number>>;
const key = 'spotland:local-usage:v1';
export function readUsage(): Usage | null {
  try {
    const raw = localStorage.getItem(key); if (!raw || raw.length > 500) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const result: Usage = {};
    for (const screen of usageScreens) {
      const count = (value as Record<string, unknown>)[screen];
      if (count !== undefined) { if (!Number.isInteger(count) || Number(count) < 0 || Number(count) > 1000000) return null; result[screen] = Number(count); }
    }
    return result;
  } catch { return null; }
}
export function writeUsage(usage: Usage | null): boolean {
  try {
    if (usage === null) localStorage.removeItem(key);
    else {
      const safe: Usage = {};
      for (const screen of usageScreens) { const count = usage[screen]; if (Number.isInteger(count) && count! >= 0) safe[screen] = Math.min(count!,1000000); }
      localStorage.setItem(key,JSON.stringify(safe));
    }
    return true;
  } catch { return false; }
}
