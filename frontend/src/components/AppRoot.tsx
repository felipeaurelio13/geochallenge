import React from 'react';

// AppRoot provides stable viewport sizing and safe-area padding for mobile browsers.
export function AppRoot({ children }: { children: React.ReactNode }) {
  return <div className="app-root">{children}</div>;
}
