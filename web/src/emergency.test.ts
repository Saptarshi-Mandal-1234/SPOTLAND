import { expect, it } from 'vitest';
import { emergencyNumbers } from './emergency';
it('bundles the required numbers with source and regional coverage notes', () => {
  expect(emergencyNumbers.map(item => item.number)).toEqual(['112', '100', '101', '108', '102', '1091']);
  expect(emergencyNumbers.every(item => item.source.startsWith('https://') && item.note.length > 0)).toBe(true);
});
