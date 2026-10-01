import { describe, expect, it, vi } from 'vitest';
import worker from './index';
const env = { ALLOWED_ORIGIN: 'https://travel.example' };
describe('hello-world API', () => {
  it('returns health and allows the configured frontend', async () => {
    const response = await worker.fetch(new Request('https://api.example/api/health', { headers: { Origin: env.ALLOWED_ORIGIN } }), env);
    expect(await response.json()).toMatchObject({ status: 'ok' });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(env.ALLOWED_ORIGIN);
  });
  it('does not allow arbitrary origins', async () => {
    const response = await worker.fetch(new Request('https://api.example/api/health', { headers: { Origin: 'https://other.example' } }), env);
    expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
  });
  it('rejects unknown routes and unsupported methods', async () => {
    expect((await worker.fetch(new Request('https://api.example/nope'), env)).status).toBe(404);
    expect((await worker.fetch(new Request('https://api.example/api/health', { method: 'POST' }), env)).status).toBe(405);
  });
  it('keeps SOS sending disabled when only push testing is enabled', async () => {
    const pushEnv = { ...env, PUSH_ENABLED: 'true', SOS_ENABLED: 'false' };
    const config = await worker.fetch(new Request('https://api.example/api/sos-config'), pushEnv);
    expect(await config.json()).toMatchObject({ enabled: false, receivingEnabled: false, pushPublicKey: null });
    const response = await worker.fetch(new Request('https://api.example/api/sos', { method: 'POST' }), pushEnv);
    expect(response.status).toBe(503);
    const configured = { ...pushEnv, DB: { prepare: vi.fn() }, DEVICE_SECRET: 'device-test-secret', VAPID_PUBLIC_KEY: 'A'.repeat(87), VAPID_PRIVATE_KEY: 'B'.repeat(43), VAPID_SUBJECT: 'mailto:operator@example.test' };
    const ready = await worker.fetch(new Request('https://api.example/api/sos-config'), configured);
    expect(await ready.json()).toMatchObject({ enabled: false, receivingEnabled: true });
    expect((await worker.fetch(new Request('https://api.example/api/sos', { method: 'POST' }), configured)).status).toBe(503);
    expect(configured.DB.prepare).not.toHaveBeenCalled();
  });
  it('validates search and nearby inputs before calling providers', async () => {
    expect((await worker.fetch(new Request('https://api.example/api/weather'), env)).status).toBe(400);
    expect((await worker.fetch(new Request('https://api.example/api/weather?lat=28&lon=77'), env)).status).toBe(503);
    expect((await worker.fetch(new Request('https://api.example/api/safety?lat=NaN&lon=77'), env)).status).toBe(400);
    expect((await worker.fetch(new Request('https://api.example/api/safety?lat=28&lon=77'), env)).status).toBe(503);
    expect((await worker.fetch(new Request('https://api.example/api/route?mode=walk'), env)).status).toBe(400);
    expect((await worker.fetch(new Request('https://api.example/api/route?startLat=28&startLon=77&endLat=28.01&endLon=77.01&mode=fly'), env)).status).toBe(400);
    expect((await worker.fetch(new Request('https://api.example/api/search?q=x'), env)).status).toBe(400);
    expect((await worker.fetch(new Request('https://api.example/api/nearby'), env)).status).toBe(400);
    expect((await worker.fetch(new Request('https://api.example/api/nearby?lat=28&lon=77&radius=999999'), env)).status).toBe(400);
    expect((await worker.fetch(new Request('https://api.example/api/nearby?lat=28&lon=77'), env)).status).toBe(503);
  });
});
