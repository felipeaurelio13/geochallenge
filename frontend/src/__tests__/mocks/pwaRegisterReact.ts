// Test-only stand-in for the `virtual:pwa-register/react` module that
// vite-plugin-pwa injects at build/dev time. Vitest runs against
// vitest.config.ts (no VitePWA plugin registered), so the real virtual
// module never exists in the test environment — this alias (see
// vitest.config.ts) keeps usePwaUpdateNotice.ts importable in tests without
// pulling in the whole PWA build pipeline.
import { useState } from 'react';

export function useRegisterSW() {
  const [needRefresh] = useState(false);
  const [offlineReady] = useState(false);
  return {
    needRefresh: [needRefresh, () => {}] as [boolean, (v: boolean) => void],
    offlineReady: [offlineReady, () => {}] as [boolean, (v: boolean) => void],
    updateServiceWorker: async () => {},
  };
}
