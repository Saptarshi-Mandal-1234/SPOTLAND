import { indiaDate } from '../../shared/calendar';
import type { ExternalEvent, ExternalEvents } from '../../shared/external-events';
import { readCache, reserveProvider, writeCache, type Database } from './db';
import { ProviderError } from './providers';
export interface ExternalEventsEnv { DB?: Database; WIKIDATA_URL?: string; WIKIDATA_USER_AGENT?: string }
const coverage = 'Wikidata: community-maintained open data, not organiser-confirmed listings. Coverage is sparse; dates are event start dates. Only explicit event coordinates are mapped.';
export function eventsQuery(now = Date.now()) {
  const start = indiaDate(now - 7 * 86400000); const end = indiaDate(now + 366 * 86400000);
  return `SELECT DISTINCT ?item ?itemLabel ?date ?precision ?locationLabel ?coord WHERE {
    hint:Query hint:optimizer "None".
    { SELECT DISTINCT ?item ?date WHERE {
      hint:Query hint:optimizer "None".
      ?item wdt:P17 wd:Q668.
      { ?item wdt:P585 ?date. } UNION { ?item wdt:P580 ?date. }
      FILTER(?date >= "${start}T00:00:00Z"^^xsd:dateTime && ?date < "${end}T00:00:00Z"^^xsd:dateTime)
    } ORDER BY ?date LIMIT 200 }
      ?item (p:P585/psv:P585|p:P580/psv:P580) ?timeValue.
      ?timeValue wikibase:timeValue ?date; wikibase:timePrecision ?precision.
      FILTER(?precision >= 11)
      VALUES ?type { wd:Q132241 wd:Q182832 wd:Q464980 wd:Q13406554 }
      ?item wdt:P31/wdt:P279* ?type.
      hint:Prior hint:gearing "forward".
    OPTIONAL { ?item wdt:P276 ?location. }
    OPTIONAL { ?item wdt:P625 ?coord. }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } ORDER BY ?date LIMIT 100`;
}
type Binding = Record<string, { value?: unknown }>;
export function parseExternalEvents(data: unknown, now = Date.now()): ExternalEvents {
  const bindings = (data as { results?: { bindings?: unknown } })?.results?.bindings;
  if (!Array.isArray(bindings) || bindings.length > 100) throw new ProviderError('Unexpected external event data.', 502);
  const events = new Map<string, ExternalEvent>();
  for (const raw of bindings) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Binding; const value = (key: string) => typeof row[key]?.value === 'string' ? row[key].value as string : '';
    const id = /^https?:\/\/www\.wikidata\.org\/entity\/(Q\d+)$/.exec(value('item'))?.[1];
    const name = value('itemLabel').trim(); const date = value('date').slice(0, 10); const time = Date.parse(`${date}T00:00:00Z`);
    if (!id || !name || name === id || name.length > 200 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date || Number(value('precision')) < 11 || !Number.isFinite(Number(value('precision'))) || date < indiaDate(now - 7 * 86400000) || date > indiaDate(now + 365 * 86400000)) continue;
    const key = `${id}:${date}`; const location = value('locationLabel').trim();
    const event: ExternalEvent = { id: `wikidata:${key}`, name, date, location: location && location.length <= 200 && !/^Q\d+$/.test(location) ? location : 'Venue not specified', sourceUrl: `https://www.wikidata.org/wiki/${id}` };
    const point = /^Point\((-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)\)$/.exec(value('coord'));
    if (point) { const lon = Number(point[1]); const lat = Number(point[2]); if (lat >= 6 && lat <= 38 && lon >= 68 && lon <= 98) event.point = { lat, lon }; }
    // Several locations/statements can produce duplicate rows; keep one stable entry.
    if (!events.has(key)) events.set(key, event);
  }
  return { events: [...events.values()].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name)), fetchedAt: now, coverage };
}
function retryMs(header: string | null, now: number) {
  const seconds = header && /^\d+$/.test(header) ? Number(header) : NaN;
  const date = header ? Date.parse(header) : NaN;
  return Math.max(60000, Number.isFinite(seconds) ? seconds * 1000 : Number.isFinite(date) ? date - now : 300000);
}
export async function externalEvents(env: ExternalEventsEnv): Promise<ExternalEvents> {
  if (!env.DB) throw new ProviderError('External events need the configured database.', 503);
  const agent = env.WIKIDATA_USER_AGENT;
  if (!agent || !/^[^\r\n]+\/[^\r\n]+\([^\r\n]*(https:\/\/|[^\s()]+@|User:)[^\r\n]*\)/.test(agent) || /example\.(com|org)|localhost|127\.0\.0\.1/i.test(agent)) throw new ProviderError('External events are not enabled yet. The operator must configure a public contact for Wikidata.', 503);
  const endpoint = env.WIKIDATA_URL || 'https://query.wikidata.org/sparql';
  const key = `external-events:v2:${endpoint}:${indiaDate()}`;
  const cached = await readCache(env.DB, key); if (cached !== null) return cached as ExternalEvents;
  const blocked = await readCache(env.DB, `wikidata-backoff:${endpoint}`); if (blocked !== null) throw new ProviderError('Wikidata is busy. Try again later.', 429);
  // One bounded miss per minute across users; no upstream autocomplete or retries.
  if (!await reserveProvider(env.DB, 'wikidata-events', 60000)) throw new ProviderError('External events are busy. Wait a minute before retrying.', 429);
  const url = new URL(endpoint); url.search = new URLSearchParams({ query: eventsQuery(), format: 'json', timeout: '20000' }).toString();
  let response: Response;
  try { response = await fetch(url, { headers: { 'User-Agent': agent, Accept: 'application/sparql-results+json', 'Accept-Encoding': 'gzip,deflate' }, signal: AbortSignal.timeout(25000) }); }
  catch { throw new ProviderError('Wikidata could not be reached. Community events still work.', 502); }
  if (response.status === 429) {
    await writeCache(env.DB, `wikidata-backoff:${endpoint}`, true, retryMs(response.headers.get('Retry-After'), Date.now()));
    throw new ProviderError('Wikidata is busy. Try again later.', 429);
  }
  if (!response.ok) throw new ProviderError('Wikidata could not load events. Community events still work.', 502);
  let data: unknown; try { data = await response.json(); } catch { throw new ProviderError('Unexpected external event data.', 502); }
  const result = parseExternalEvents(data); await writeCache(env.DB, key, result, 6 * 3600000); return result;
}
