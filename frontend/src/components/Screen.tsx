import React from 'react';
import { useLocation } from 'react-router-dom';
import { AppFooter } from './AppFooter';

export type ScreenProps = {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

// Screen encapsulates a single viewport-sized route with fixed header/footer slots.
export function Screen({ header, footer, children }: ScreenProps) {
  const { pathname } = useLocation();
  const isGameplayRoute = pathname.startsWith('/game/')
    || pathname === '/duel'
    || /^\/challenges\/[^/]+\/play$/.test(pathname);
  const footerContent = footer ?? <AppFooter />;

  return (
    <section className="screen min-h-0">
      {header ? <header className="screen-header">{header}</header> : null}
      <main className="screen-content overflow-y-auto overscroll-contain">{children}</main>
      {!isGameplayRoute && <footer className="screen-footer">{footerContent}</footer>}
    </section>
  );
}
