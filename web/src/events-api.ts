import { API_BASE_URL } from './config';
import type { EventInput, EventRecord } from '../../shared/events';
import type { ExternalEvents } from '../../shared/external-events';
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  await Promise.resolve(); if (init.signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Event request failed. Try again.'); return data;
}
export const listEvents = (start: string, end: string, signal?: AbortSignal) => request<EventRecord[]>(`/events?${new URLSearchParams({ start, end })}`, { signal });
export const listExternalEvents = (signal?: AbortSignal) => request<ExternalEvents>('/external-events', { signal });
export const submitEvent = (event: EventInput) => request<{ id: string; status: string }>('/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) });
export const pendingEvents = (token: string) => request<EventRecord[]>('/admin/events', { headers: { Authorization: `Bearer ${token}` } });
export const moderateEvent = (id: string, status: 'approved' | 'rejected', token: string) => request('/admin/events', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
