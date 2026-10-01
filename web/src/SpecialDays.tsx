import { useEffect, useRef, useState } from 'react';
import { calendarRange, displayDate, indiaDate, specialDaysFor, type CalendarFilter, type SpecialDay } from '../../shared/calendar';
import calendar from './special-days.json';
export default function SpecialDays({ onClose, onExplore }: { onClose: () => void; onExplore: () => void }) {
  const [filter, setFilter] = useState<CalendarFilter>('upcoming'); const [now, setNow] = useState(Date.now());
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
  const days = specialDaysFor(calendar.days as SpecialDay[], filter, now); const range = calendarRange(filter, now); const supported = indiaDate(now).startsWith(String(calendar.year));
  return <section className="special-days" aria-label="Festivals and holidays">
    <header className="explore-header"><button onClick={onClose}>← Home</button><strong>Dates worth a detour</strong></header>
    <div className="calendar-content"><span className="eyebrow">INDIA / CURATED 2026 CALENDAR</span><h1 ref={heading} tabIndex={-1}>Big days. Little plans.</h1><p>Festivals and public holidays, for a heads-up before you head out.</p>
      <div className="calendar-filters" role="group" aria-label="Calendar dates">{(['today', 'weekend', 'upcoming'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'today' ? 'Today' : value === 'weekend' ? 'This weekend' : 'Upcoming'}</button>)}</div>
      <p>All dates use India Standard Time. {filter === 'weekend' && `${displayDate(range.start)} – ${displayDate(range.end)}.`}</p>
      <p className="calendar-note">Selected {calendar.year} dates, not a complete state/UT holiday calendar. Regional observance, moon-sighting dates and business closures can vary. Confirm local schedules before travelling.</p>
      {!supported && <p role="status">The curated calendar covers 2026 only. Dates for your current year have not been verified yet.</p>}
      <p role="status">{days.length} {days.length === 1 ? 'special day' : 'special days'} in this view.</p>
      {days.length ? <ul className="calendar-cards">{days.map(day => <li key={day.id}><span className="eyebrow">{day.kind === 'holiday' ? 'PUBLIC HOLIDAY' : 'FESTIVAL / OBSERVANCE'}</span><h2>{day.name}</h2><time dateTime={day.date}>{displayDate(day.date)}</time><p>{day.scope}</p><a href={calendar.source} target="_blank" rel="noreferrer">Verify official calendar ↗</a></li>)}</ul> : <p>No curated dates in this view. Local celebrations may still be happening.</p>}
      <section className="calendar-note" aria-label="Calendar map coverage"><h2>Where’s the celebration?</h2><p>These are calendar dates without event venues, so there are no festival pins yet. Use the nearby map to explore places; it does not confirm a celebration is happening there.</p><button onClick={onExplore}>Explore nearby map ↗</button></section>
      <details><summary>Sources & license</summary><p>Facts checked {calendar.checkedOn} against <a href={calendar.source} target="_blank" rel="noreferrer">{calendar.sourceName}</a>. Original curated dataset: <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noreferrer">CC0 1.0</a>. {calendar.licenseNote}</p></details>
    </div>
  </section>;
}
