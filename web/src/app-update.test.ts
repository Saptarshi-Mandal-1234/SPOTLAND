import { expect, it, vi } from 'vitest';
import { requestAppUpdate } from './app-update';

it('reports a failed update without an unhandled rejection and permits retry', async () => {
  const update = vi.fn().mockRejectedValueOnce(new Error('Service worker unavailable')).mockResolvedValueOnce(undefined);
  await expect(requestAppUpdate(update)).resolves.toContain('App update failed');
  await expect(requestAppUpdate(update)).resolves.toContain('Update requested');
  expect(update).toHaveBeenCalledTimes(2);
});

it('also handles a synchronously failed update adapter', async () => {
  await expect(requestAppUpdate(() => { throw new Error('Registration missing'); })).resolves.toContain('Reconnect and try again');
});
