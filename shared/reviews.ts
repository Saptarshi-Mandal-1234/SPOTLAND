export interface ReviewPhoto { id: string; status: 'pending' | 'approved' | 'hidden'; url?: string }
export interface Review { id: string; rating: number; text: string; createdAt: number; updatedAt: number; photos?: ReviewPhoto[] }
export interface ReviewList { reviews: Review[]; count: number; average: number | null; mine: (Review & { status: 'visible' | 'hidden'; photos: ReviewPhoto[] }) | null }
export function reviewPlaceId(value: unknown): string {
  if (typeof value !== 'string' || value.length > 100 || !/^(?:(?:node|way|relation)\/\d+|seed:[a-z0-9-]+|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/.test(value)) throw new Error('Invalid place identifier.');
  return value;
}
export function validateReview(value: unknown): { placeId: string; rating: number; text: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid review.');
  const data = value as Record<string, unknown>; const placeId = reviewPlaceId(data.placeId);
  if (typeof data.rating !== 'number' || !Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) throw new Error('Choose a rating from 1 to 5.');
  if (typeof data.text !== 'string' || [...data.text.trim()].length < 10 || [...data.text].length > 1000 || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(data.text)) throw new Error('Write 10–1000 characters of plain text.');
  return { placeId, rating: data.rating, text: data.text.trim() };
}
