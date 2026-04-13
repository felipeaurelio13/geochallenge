import React from 'react';
import { Link } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  backTo?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  sticky?: boolean;
  className?: string;
}

export function PageHeader({ title, backTo = '/menu', backLabel = '←', actions, sticky = false, className = '' }: PageHeaderProps) {
  return (
    <header className={`bg-gray-800 border-b border-gray-700 ${sticky ? 'sticky top-0 z-10 backdrop-blur-sm bg-gray-800/95' : ''} ${className}`}>
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to={backTo} className="text-gray-400 hover:text-white transition-colors text-sm">
          {backLabel}
        </Link>
        <h1 className="text-lg font-bold text-white">{title}</h1>
        <div className="min-w-[2rem] flex justify-end">{actions}</div>
      </div>
    </header>
  );
}
