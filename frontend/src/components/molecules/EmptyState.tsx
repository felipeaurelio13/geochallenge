import React from 'react';

interface EmptyStateProps {
  emoji?: string;
  message: string;
  action?: React.ReactNode;
  className?: string;
}

// QA round 3 design audit: el EmptyState pegado arriba con `py-12` dejaba
// ~300px de gris muerto debajo (Challenges, History, etc.). Ahora ocupa el
// flex disponible y se centra vertical+horizontal — se siente equilibrado.
export function EmptyState({ emoji = '📭', message, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-1 min-h-[40vh] flex-col items-center justify-center text-center py-10 px-4 ${className}`}>
      {emoji && <div className="text-5xl mb-4 opacity-90">{emoji}</div>}
      <p className="text-app-subtle mb-5 max-w-sm">{message}</p>
      {action}
    </div>
  );
}
