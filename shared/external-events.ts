export interface ExternalEvent {
  id: string; name: string; date: string; location: string; sourceUrl: string;
  // Only an event's own coordinate is mapped; city/region centroids are not venues.
  point?: { lat: number; lon: number };
}
export interface ExternalEvents { events: ExternalEvent[]; fetchedAt: number; coverage: string }
