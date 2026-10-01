import { API_BASE_URL } from './config';
export async function checkHealth(signal?: AbortSignal): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/health`, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000), cache: 'no-store' });
  if (!response.ok) throw new Error('API unavailable');
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || !('status' in data) || data.status !== 'ok') throw new Error('Unexpected API response');
  return 'Connected';
}
