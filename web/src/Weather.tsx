import { useEffect, useRef, useState } from 'react';
import type { Place } from '../../shared/places';
import { conditions, weatherTime, type Forecast } from '../../shared/weather';
import { bestWindows, openingStatus, weatherAlerts, type Setting } from '../../shared/weather-score';
import { fetchWeather } from './weather-api';
export default function Weather({ place, onClose }: { place: Place; onClose: () => void }) {
  const [forecast, setForecast] = useState<Forecast | null>(null); const [message, setMessage] = useState('Checking the sky…'); const [reload, setReload] = useState(0); const [busy, setBusy] = useState(true);
  const [setting, setSetting] = useState<Setting>(['museum', 'cafe', 'restaurant', 'shopping', 'gaming'].includes(place.category) ? 'indoor' : 'outdoor');
  const [now, setNow] = useState(Date.now()); const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const controller = new AbortController(); setBusy(true); setForecast(null); setMessage('Checking the sky…');
    fetchWeather(place.lat, place.lon, controller.signal).then(data => { if (!controller.signal.aborted) { setForecast(data); setMessage('Forecast loaded. All times are IST.'); setNow(Date.now()); } }).catch(error => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Weather unavailable.'); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [place.lat, place.lon, reload]);
  const hours = forecast?.hours.filter(hour => hour.time >= now && hour.time < now + 48 * 3600000) || [];
  const windows = bestWindows(hours, place.hours, setting, now);
  const alerts = new Map<string, number>(); for (const hour of hours) for (const alert of weatherAlerts(hour)) if (!alerts.has(alert)) alerts.set(alert, hour.time);
  const unknownHours = !hours.length || openingStatus(place.hours, hours[0].time) === 'unknown';
  return <section className="weather-panel" aria-label="Weather and best time">
    <div className="directions-title"><div><span className="eyebrow">SKY CHECK / NEXT 48 HOURS</span><h2 ref={heading} tabIndex={-1}>{place.name}: weather & best time</h2></div><button onClick={onClose}>Close weather ✕</button></div>
    <p className="weather-mascot" aria-hidden="true">☀ <span>Chalo? Ask the sky first.</span></p>
    <p className="location-note">This place’s coordinates, rounded to about 1 km, go through our API to Open-Meteo. No personal location is requested. Forecasts are cached for 30 minutes.</p>
    <p role="status">{message}</p><button disabled={busy} onClick={() => setReload(value => value + 1)}>{busy ? 'Loading forecast…' : 'Retry / refresh weather'}</button>
    {forecast && <>
      <p>Forecast fetched {weatherTime(forecast.fetchedAt)}. {now - forecast.fetchedAt > 3600000 && <strong>Stale forecast — refresh before deciding.</strong>}</p>
      <label>Visit setting <select value={setting} onChange={event => setSetting(event.target.value as Setting)}><option value="outdoor">Outdoor</option><option value="indoor">Indoor</option></select></label><p className="location-note">Setting starts from the place category; choose what matches your visit. Indoor plans still involve travelling there.</p>
      <section className="weather-alerts" aria-label="Forecast cautions"><h3>Forecast cautions</h3>{alerts.size ? <ul>{Array.from(alerts, ([alert, time]) => <li key={alert}><strong>{alert}</strong> · first at {weatherTime(time)}</li>)}</ul> : <p>No heat, heavy-rain or thunderstorm thresholds reached in these forecast hours.</p>}<p>App planning cautions, not official warnings. Weather can change; follow local advisories.</p></section>
      <h3>Best time to go</h3><p><strong>OSM hours:</strong> {place.hours}. {unknownHours ? 'Hours cannot be verified; these windows are weather-only. Confirm opening with the venue.' : 'Windows use the listed opening hours. Confirm with the venue; OSM may be out of date.'}</p>
      {windows.length ? <ol className="weather-windows">{windows.map(window => <li key={window.start}><strong>{weatherTime(window.start)} → {weatherTime(window.end)}</strong><p>A {setting === 'outdoor' ? 'more comfortable outdoor' : 'better indoor-visit'} window: around {window.temperature}°C, up to {window.rainChance}% rain chance. {unknownHours ? 'Opening unverified.' : 'Within listed hours.'}</p></li>)}</ol> : <p>No suitable two-hour window found in the next 48 hours. Check opening times and try another day.</p>}
      <details><summary>How we choose windows</summary><p>Two consecutive hours, ranked by rain chance, temperature comfort (18–30°C), heat, wind, daylight, visit setting and supported opening hours. Storms and heavy rain exclude travel windows; outdoor heat of 35°C+ or wind of 40 km/h+ also exclude them. Complex schedules and holiday exceptions are unverified. These are preferences, not a safety guarantee.</p></details>
      <h3>Hourly forecast · day & night · IST</h3>{!hours.length && <p>No upcoming hours available. Refresh the forecast.</p>}
      <div className="weather-table" role="region" aria-label="Hourly forecast table, scroll horizontally" tabIndex={0}><table><caption>Next 48 hours · rain chance % · rain mm/h · wind km/h</caption><thead><tr><th scope="col">Time (IST)</th><th scope="col">Conditions</th><th scope="col">Temp °C</th><th scope="col">Rain %</th><th scope="col">Rain mm</th><th scope="col">Wind km/h</th></tr></thead><tbody>{hours.map(hour => <tr key={hour.time}><th scope="row">{weatherTime(hour.time)} · {hour.isDay ? 'Day' : 'Night'}</th><td>{conditions(hour.code)}</td><td>{hour.temperature}</td><td>{hour.rainChance}</td><td>{hour.precipitation}</td><td>{hour.wind}</td></tr>)}</tbody></table></div>
    </>}
    <p className="location-note">Weather: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Data summarized; visit rankings calculated by SPOTLAND. No background notifications.</p>
  </section>;
}

