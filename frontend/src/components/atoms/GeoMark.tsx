type GeoMarkProps = {
  className?: string;
  title?: string;
};

/**
 * Marca mínima de GeoChallenge: una G construida con meridiano, paralelo y
 * coordenada. Es SVG propio para poder usar la misma geometría en interfaz y
 * favicon sin depender de emojis ni fuentes externas.
 */
export function GeoMark({ className = '', title }: GeoMarkProps) {
  const labelled = Boolean(title);

  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role={labelled ? 'img' : undefined}
      aria-hidden={labelled ? undefined : true}
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2.5" />
      <path d="M4.6 16h14.2M16 4c3.1 3.2 4.7 7.2 4.7 12S19.1 24.8 16 28M16 4c-3.1 3.2-4.7 7.2-4.7 12S12.9 24.8 16 28" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
      <path d="M27.6 16h-8.1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="25.6" cy="16" r="2.4" fill="currentColor" />
    </svg>
  );
}
