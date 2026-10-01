// Link-out only. These are browse pages, never an availability/partnership claim.
export const bookingProviders = [
  { label: 'BookMyShow · browse city', base: 'https://in.bookmyshow.com/explore/home/', cities: { Delhi: 'national-capital-region-ncr', Mumbai: 'mumbai', Bengaluru: 'bengaluru' } },
  { label: 'District · choose city', base: 'https://www.district.in/', cities: {} },
];
export function cityBookingLinks(city: string) {
  return bookingProviders.map(provider => { const slug = (provider.cities as Record<string, string>)[city]; return { label: slug ? provider.label : provider.label.replace('browse city', 'choose city'), url: slug ? provider.base + slug : new URL(provider.base).origin + '/' }; });
}
