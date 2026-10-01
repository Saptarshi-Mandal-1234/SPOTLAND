import { request } from './events-api';
import type { CreatedShare, SenderShare, SharePosition, ShareSnapshot } from '../../shared/live-share';
const post = (data: unknown, signal?: AbortSignal): RequestInit => ({ method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal });
export const prepareShareDevice = (signal?: AbortSignal) => request('/share-device', post({ consent: true }, signal));
export const createShare = (share: SenderShare, hours: number, position: SharePosition, signal?: AbortSignal) => request<CreatedShare>('/live-share', post({ action: 'create', id: share.id, token: share.token, hours, position, consent: true }, signal));
export const updateShare = (id: string, position: SharePosition, signal?: AbortSignal) => request<ShareSnapshot>('/live-share', post({ action: 'update', id, position }, signal));
export const stopShare = (share: SenderShare) => request('/live-share', post({ action: 'stop', id: share.id, token: share.token }));
export const senderStatus = (share: SenderShare, signal?: AbortSignal) => request<CreatedShare>('/live-share', post({ action: 'status', id: share.id, nonce: share.token }, signal));
export const readShare = (token: string, signal?: AbortSignal) => request<ShareSnapshot>('/live-share', { credentials: 'omit', headers: { Authorization: `Bearer ${token}` }, signal });
