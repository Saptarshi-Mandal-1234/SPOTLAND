import type { SavedTrip, TripInput } from '../../shared/trips';
import type { Route } from '../../shared/routes';
import { request } from './events-api';
const post = (data: unknown, signal?: AbortSignal): RequestInit => ({method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal});
export const tripRoute = (trip: TripInput, signal?: AbortSignal) => request<Route>('/trip-route',post(trip,signal));
export const savedTrips = (signal?: AbortSignal) => request<Omit<SavedTrip,'stops'>[]>('/trips',{credentials:'same-origin',signal});
export const reopenTrip = (id: string, signal?: AbortSignal) => request<SavedTrip>('/trips?'+new URLSearchParams({id}),{credentials:'same-origin',signal});
export const saveTrip = (id: string, trip: TripInput, signal?: AbortSignal) => request<SavedTrip>('/trips',post({action:'save',id,trip},signal));
export const removeTrip = (id: string, signal?: AbortSignal) => request('/trips',post({action:'remove',id},signal));
