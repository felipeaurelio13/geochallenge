import React from 'react';

type ScreenLayoutProps = {
  header?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  contentClassName?: string;
};

export function ScreenLayout({ header, children, footer, contentClassName = '' }: ScreenLayoutProps) {
  return (
    <div className="app-shell">
      {header}
      <main className={`mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-4 sm:px-6 ${contentClassName}`.trim()}>{children}</main>
      {footer}
    </div>
  );
}
