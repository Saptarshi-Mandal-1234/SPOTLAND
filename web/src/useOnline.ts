import { useEffect, useState } from 'react';
export function watchConnection(update: () => void) {
  window.addEventListener('online', update); window.addEventListener('offline', update);
  return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
}
export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => watchConnection(() => setOnline(navigator.onLine)), []);
  return online;
}
