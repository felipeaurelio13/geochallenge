import React from 'react';

interface EmptyStateProps {
  emoji?: string;
  message: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ emoji = '📭', message, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      {emoji && <div className="text-4xl mb-4">{emoji}</div>}
      <p className="text-gray-400 mb-4">{message}</p>
      {action}
    </div>
  );
}
