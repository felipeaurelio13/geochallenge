import React from 'react';
import { AppFooter } from './AppFooter';

export type ScreenProps = {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

// Screen encapsulates a single viewport-sized route with fixed header/footer slots.
export function Screen({ header, footer, children }: ScreenProps) {
  const footerContent = footer ?? <AppFooter />;

  return (
    <section className="screen">
      {header ? <header className="screen-header">{header}</header> : null}
      <main className="screen-content">{children}</main>
      <footer className="screen-footer">{footerContent}</footer>
    </section>
  );
}
