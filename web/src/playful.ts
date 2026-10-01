export function swipeChoice(offset: number, velocity: number): 'hangout' | 'skip' | null {
  if (!Number.isFinite(offset) || !Number.isFinite(velocity)) return null;
  if (Math.abs(offset) < 80 && !(Math.abs(offset) >= 25 && Math.abs(velocity) >= 500 && Math.sign(offset) === Math.sign(velocity))) return null;
  return offset > 0 ? 'hangout' : 'skip';
}

export function lightHaptic(enabled: boolean) {
  if (!enabled || typeof navigator.vibrate !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try { navigator.vibrate(12); } catch { /* Optional browser feedback must never interrupt an action. */ }
}
