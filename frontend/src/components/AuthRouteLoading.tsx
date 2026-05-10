import { LoadingSpinner } from './LoadingSpinner';

export function AuthRouteLoading() {
  return (
    <div className="h-full min-h-0 bg-[var(--color-bg-app)] flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
