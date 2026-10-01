import type { ReactNode } from 'react';

export function Sticker({ children, tone = 'mustard', floating = false }: { children: ReactNode; tone?: 'mustard' | 'lilac'; floating?: boolean }) {
  return <span className={`sticker ${tone}${floating ? ' floating' : ''}`}>{children}</span>;
}

// Shared transform/opacity-only entrance for later sheets and postcards.
export const postcardMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { type: 'spring' as const, stiffness: 260, damping: 24 },
};
