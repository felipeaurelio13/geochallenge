import { useUiStore } from '../../store/useUiStore';

interface SkeletonLineProps {
  className?: string;
}

/** A single pulsing bar. Pass width/height via className (e.g. "h-4 w-24"). */
export function SkeletonLine({ className = '' }: SkeletonLineProps) {
  const prefersReducedMotion = useUiStore((state) => state.prefersReducedMotion);

  return (
    <div
      aria-hidden="true"
      className={`rounded-md bg-[var(--color-surface-muted)] ${prefersReducedMotion ? '' : 'animate-pulse'} ${className}`}
    />
  );
}

interface SkeletonCardProps {
  className?: string;
}

/** A rounded card-shaped skeleton block matching Card.tsx's border/radius/bg tokens. */
export function SkeletonCard({ className = '' }: SkeletonCardProps) {
  const prefersReducedMotion = useUiStore((state) => state.prefersReducedMotion);

  return (
    <div
      aria-hidden="true"
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 ${
        prefersReducedMotion ? '' : 'animate-pulse'
      } ${className}`}
    >
      <div className="space-y-3">
        <div className="h-4 w-2/3 rounded-md bg-[var(--color-surface)]" />
        <div className="h-3 w-1/2 rounded-md bg-[var(--color-surface)]" />
        <div className="h-8 w-full rounded-lg bg-[var(--color-surface)]" />
      </div>
    </div>
  );
}

interface SkeletonRowProps {
  className?: string;
}

/** A rounded row-shaped skeleton block for list items (e.g. leaderboard rows). */
export function SkeletonRow({ className = '' }: SkeletonRowProps) {
  const prefersReducedMotion = useUiStore((state) => state.prefersReducedMotion);

  return (
    <div
      aria-hidden="true"
      className={`flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 ${
        prefersReducedMotion ? '' : 'animate-pulse'
      } ${className}`}
    >
      <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--color-surface)]" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-1/3 rounded-md bg-[var(--color-surface)]" />
        <div className="h-2 w-2/3 rounded-md bg-[var(--color-surface)]" />
      </div>
      <div className="h-4 w-10 shrink-0 rounded-md bg-[var(--color-surface)]" />
    </div>
  );
}
