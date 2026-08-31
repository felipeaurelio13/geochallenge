import type { ReactNode } from 'react';

type GeoIconName = 'duel' | 'flag' | 'map' | 'landmark' | 'rank' | 'life' | 'challenge' | 'close';

type GeoIconProps = { name: GeoIconName; className?: string; title?: string; size?: number | string };

const paths: Record<GeoIconName, ReactNode> = {
  duel: <><path d="m8 6 8 8-8 8M24 6l-8 8 8 8" /><path d="M5 16h22" /></>,
  flag: <><path d="M7 28V5" /><path d="M8 6h14l-2.8 5L22 16H8" /></>,
  map: <><path d="m4 8 8-4 8 4 8-4v20l-8 4-8-4-8 4V8Z" /><path d="M12 4v20M20 8v20" /></>,
  landmark: <><path d="M5 27h22M8 24V13l8-8 8 8v11M12 24v-6h8v6M4 30h24" /></>,
  rank: <><path d="M6 27V15h6v12M13 27V8h6v19M20 27v-6h6v6M4 30h24" /></>,
  life: <path d="M16 27S5 20.1 5 11.7C5 7.9 7.7 5 11.2 5c2.1 0 4 1.1 4.8 2.8C16.8 6.1 18.7 5 20.8 5 24.3 5 27 7.9 27 11.7 27 20.1 16 27 16 27Z" />,
  challenge: <><circle cx="16" cy="16" r="11" /><path d="m12 16 2.5 2.5L20 12" /></>,
  close: <path d="m9 9 14 14M23 9 9 23" />,
};

export function GeoIcon({ name, className = '', title, size }: GeoIconProps) {
  const labelled = Boolean(title);
  return <svg viewBox="0 0 32 32" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} role={labelled ? 'img' : undefined} aria-hidden={labelled ? undefined : true} aria-label={title} stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">{title ? <title>{title}</title> : null}{paths[name]}</svg>;
}
