export { APP_NAME } from '../../shared/brand';
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
export const fonts = { heading: 'Fraunces', body: 'DM Sans', accent: 'Caveat' } as const;
