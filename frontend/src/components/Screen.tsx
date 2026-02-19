import React from 'react';

export type ScreenProps = {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

// Screen encapsulates a single viewport-sized route with fixed header/footer slots.
export function Screen({ header, footer, children }: ScreenProps) {
  return (
    <section className="screen">
      {header ? <header className="screen-header">{header}</header> : null}
      <main className="screen-content">{children}</main>
      {footer ? <footer className="screen-footer">{footer}</footer> : null}
    </section>
  );
}
