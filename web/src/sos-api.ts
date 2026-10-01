import { request } from './events-api';
import type { NearbyAlert, SosReceipt } from '../../shared/sos';
const post = (data: unknown, signal?: AbortSignal): RequestInit => ({ method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal });
export interface NearbyState { expiresAt: number; pushEnabled: boolean; alerts: NearbyAlert[] }
export interface SosIntent { id: string; startedAt: number; broadcast: boolean; closing: boolean; geohash?: string; shareId: string; shareNonce: string; shareExpiresAt: number }
export const sosConfig = (signal?: AbortSignal) => request<{ enabled: boolean; receivingEnabled: boolean; pushPublicKey: string | null; radiusKm: number }>('/sos-config',{signal});
export const nearbyAction = (data: unknown, signal?: AbortSignal) => request<NearbyState>('/nearby-alerts',post(data,signal));
export const testSosPush = (signal?: AbortSignal) => request<{accepted: boolean; message: string}>('/nearby-alerts',post({action:'test',consent:true},signal));
export const createSos = (intent: SosIntent, signal?: AbortSignal) => request<SosReceipt>('/sos',post({action:'create',id:intent.id,startedAt:intent.startedAt,geohash:intent.geohash,shareId:intent.shareId,consent:true},signal));
export const sosStatus = (id: string, signal?: AbortSignal) => request<SosReceipt>('/sos',post({action:'status',id},signal));
export const closeSos = (id: string) => request('/sos',post({action:'close',id}));
export const respondSos = (id: string, action: 'report' | 'help') => request<{message?:string}>('/sos',post({action,id}));
