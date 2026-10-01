import { request } from './events-api';
import { API_BASE_URL } from './config';
import type { Review, ReviewList } from '../../shared/reviews';
export interface ModeratedReview extends Review { placeId: string; status: 'visible' | 'hidden'; reports: number }
export interface ModeratedReviewPhoto { id: string; reviewId: string; placeId: string; rating: number; text: string; status: 'pending' | 'hidden'; reports: number; createdAt: number }
export const listReviews = (placeId: string, signal?: AbortSignal) => request<ReviewList>(`/reviews?${new URLSearchParams({ placeId })}`, { credentials: 'same-origin', signal });
export const reviewAction = (data: { action: 'save'; placeId: string; rating: number; text: string } | { action: 'remove' | 'report'; id: string }, signal?: AbortSignal) => request('/reviews', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal });
export const moderatedReviews = (token: string, signal?: AbortSignal) => request<ModeratedReview[]>('/admin/reviews', { headers: { Authorization: `Bearer ${token}` }, signal });
export const hideReview = (id: string, token: string, signal?: AbortSignal) => request<{ hidden: true }>('/admin/reviews', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'hide', id }), signal });
export async function uploadReviewPhoto(reviewId: string, file: File) {
  const form = new FormData(); form.set('reviewId',reviewId); form.set('photo',file,'review.jpg');
  return request<{id:string;status:'pending'}>('/review-photos',{method:'POST',credentials:'same-origin',body:form});
}
export const reviewPhotoAction = (action:'remove'|'report',id:string) => request<{removed?:true;reported?:true}>('/review-photos',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id})});
export const moderatedReviewPhotos = (token:string) => request<ModeratedReviewPhoto[]>('/admin/review-photos',{headers:{Authorization:`Bearer ${token}`}});
export const moderateReviewPhoto = (id:string,action:'approve'|'hide'|'delete',token:string) => request<{status?:string;deleted?:true}>('/admin/review-photos',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({id,action})});
export async function getModeratedPhoto(id:string,token:string):Promise<string> {
  const response = await fetch(`${API_BASE_URL}/admin/review-photos/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`, 'Cache-Control':'no-store'},cache:'no-store'});
  if (!response.ok) { let message='Photo preview failed.'; try { const data=await response.json(); if (data && typeof data.error==='string') message=data.error; } catch { /* Use the safe fallback. */ } throw new Error(message); }
  return URL.createObjectURL(await response.blob());
}
