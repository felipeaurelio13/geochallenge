import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../atoms/Icon';

type HeaderProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function Header({
  title = (
    <>
      <span className="text-primary">Geo</span>Challenge
    </>
  ),
  subtitle,
  actions,
  className = '',
}: HeaderProps) {
  return (
    <header className={`sticky top-0 z-20 border-b border-app-border/80 bg-app-surface/95 pt-[calc(env(safe-area-inset-top)+0.35rem)] backdrop-blur ${className}`.trim()}>
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
        <Link to="/" className="min-w-0 transition-opacity hover:opacity-80">
          <span className="inline-flex items-center gap-2">
            <Icon symbol="🌍" className="text-2xl" />
            <span className="truncate text-base font-bold text-app-text sm:text-lg">{title}</span>
          </span>
          {subtitle ? <p className="mt-1 text-xs text-app-subtle">{subtitle}</p> : null}
        </Link>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
