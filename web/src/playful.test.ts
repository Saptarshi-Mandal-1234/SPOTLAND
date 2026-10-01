import { expect, test } from 'vitest';
import { swipeChoice } from './playful';

test('short drags and contradictory flicks do not choose a spot', () => {
  expect(swipeChoice(12, 900)).toBeNull();
  expect(swipeChoice(40, -900)).toBeNull();
  expect(swipeChoice(70, 100)).toBeNull();
  expect(swipeChoice(NaN, 900)).toBeNull();
});
test('deliberate drags or directional flicks choose consistently', () => {
  expect(swipeChoice(90, 0)).toBe('hangout');
  expect(swipeChoice(-90, 0)).toBe('skip');
  expect(swipeChoice(30, 600)).toBe('hangout');
  expect(swipeChoice(-30, -600)).toBe('skip');
});
