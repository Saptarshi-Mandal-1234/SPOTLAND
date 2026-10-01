import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { createPortal } from 'react-dom';
import { categoryLabel, type Place } from '../../shared/places';
import { lightHaptic, swipeChoice } from './playful';

export interface MarkerOrigin { x: number; y: number }
export function SpotBadge({ place, origin }: { place: Place; origin: MarkerOrigin | null }) {
  const ref = useRef<HTMLSpanElement>(null), reduced = useReducedMotion();
  const [flight, setFlight] = useState<{ from: MarkerOrigin; to: MarkerOrigin } | null>(null);
  useLayoutEffect(() => {
    if (!origin || reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setFlight({ from: origin, to: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } });
  }, [origin, reduced]);
  const letter = categoryLabel(place.category).charAt(0).toUpperCase();
  return <><span ref={ref} className="spot-badge" aria-hidden="true" style={{ visibility: flight && !reduced ? 'hidden' : 'visible' }}>{letter}</span>{flight && !reduced && createPortal(<motion.span className="spot-badge flying-badge" aria-hidden="true" initial={{ x: flight.from.x, y: flight.from.y, scale: .8 }} animate={{ x: flight.to.x, y: flight.to.y, scale: 1 }} transition={{ type: 'spring', stiffness: 250, damping: 26 }} onAnimationComplete={() => setFlight(null)}>{letter}</motion.span>, document.body)}</>;
}

export function HangoutCards({ places, onSelect, haptics }: { places: Place[]; onSelect: (place: Place) => void; haptics: boolean }) {
  const [skipped, setSkipped] = useState<string[]>([]), reduced = useReducedMotion();
  const cards = places.slice(0, 10), current = cards.find(place => !skipped.includes(place.id));
  function choose(choice: 'hangout' | 'skip') {
    if (!current) return;
    if (choice === 'hangout') onSelect(current);
    else { lightHaptic(haptics); setSkipped(ids => [...ids, current.id]); }
  }
  return <section className="hangout-deck" aria-label="Hangout or nah"><span className="eyebrow">A QUICK VIBE CHECK</span><h2>Hangout or nah?</h2><p>Preview the nearest ten spots. Swipe right for details, left to skip. Nothing is saved automatically.</p><AnimatePresence mode="wait" initial={false}>{current ? <motion.article key={current.id} className="hangout-card" drag={reduced ? false : 'x'} dragConstraints={{ left: 0, right: 0 }} dragElastic={.65} onDragEnd={(_, info) => { const choice = swipeChoice(info.offset.x, info.velocity.x); if (choice) choose(choice); }} initial={reduced ? false : { opacity: 0, x: 20, rotate: 2 }} animate={{ opacity: 1, x: 0, rotate: 0 }} exit={reduced ? { opacity: 0 } : { opacity: 0, x: -70, rotate: -4 }} transition={{ duration: reduced ? 0 : .18 }}><span className="eyebrow">{categoryLabel(current.category)}</span><h3>{current.name}</h3><p>{current.address || 'Check the map for this spot.'}</p><small>Hours: {current.hours || 'Not supplied'}</small></motion.article> : <div className="hangout-card"><h3>Deck explored. Good wandering.</h3><p>The full list is still below.</p></div>}</AnimatePresence><div className="hangout-actions">{current ? <><button onClick={() => choose('skip')}>← Nah, next</button><button onClick={() => choose('hangout')}>Hangout → Details</button></> : <button onClick={() => setSkipped([])}>Start this deck again</button>}</div><p role="status">{current ? `${skipped.length + 1} of ${cards.length} previews` : 'All previews skipped.'}</p></section>;
}

export function PassportStamp({ name }: { name: string }) {
  const reduced = useReducedMotion();
  return <motion.div key={name} className="passport-stamp" initial={reduced ? false : { scale: 1.15, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: -6, opacity: 1 }} transition={{ duration: reduced ? 0 : .25 }}><span>POSTCARD PASSPORT</span><strong>{name}</strong><small>Picked this visit · no travel history stored</small></motion.div>;
}

export function TripConfetti({ celebration }: { celebration: number }) {
  const [visible, setVisible] = useState(false), reduced = useReducedMotion();
  useEffect(() => {
    if (!celebration || reduced) return;
    setVisible(true); const timer = window.setTimeout(() => setVisible(false), 1600);
    return () => window.clearTimeout(timer);
  }, [celebration, reduced]);
  if (!visible || reduced) return null;
  return <div className="trip-confetti" aria-hidden="true" key={celebration}>{Array.from({ length: 16 }, (_, i) => <motion.i key={i} initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }} animate={{ x: (i % 2 ? 1 : -1) * Math.min(30 + i * 9, 130), y: -60 - (i % 5) * 25, opacity: 0, rotate: i * 37 }} transition={{ duration: 1.3, delay: (i % 4) * .04 }}/>)}</div>;
}
