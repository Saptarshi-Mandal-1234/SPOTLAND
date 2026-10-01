import type { Venue } from '../../shared/venues';
// Original factual directory, CC0. Official source pages checked 2026-09-30.
// Coordinates/hours/prices remain unknown rather than inventing map pins or rates.
export const venueSeed: Venue[] = [
  { id: 'seed:ihc', name: 'India Habitat Centre', city: 'Delhi', kind: 'workshop', address: 'India Habitat Centre, New Delhi; confirm entrance on the venue site', hours: 'Confirm programme hours with venue', phone: '+911143663333', website: 'https://www.indiahabitat.org/', booking_links: [], price_note: 'Programme prices vary; check the venue site.', price_updated_at: '2026-09-30', status: 'approved', source: 'seed', sourceUrl: 'https://indiahabitat.org/Contact_us' },
  { id: 'seed:ncpa', name: 'National Centre for the Performing Arts', city: 'Mumbai', kind: 'theatre', address: 'NCPA, Nariman Point, Mumbai; confirm entrance on the venue site', hours: 'Confirm programme hours with venue', website: 'https://www.ncpamumbai.com/', booking_links: [], price_note: 'Programme prices vary; check the venue site.', price_updated_at: '2026-09-30', status: 'approved', source: 'seed', sourceUrl: 'https://www.ncpamumbai.com/venue-landing/' },
];
