import { LoadingSpinner } from './LoadingSpinner';

export function AuthRouteLoading() {
  return (
    <div className="h-full min-h-0 bg-gray-900 flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
