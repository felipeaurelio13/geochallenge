/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SOCKET_URL: string;
  readonly VITE_RANKING_USE_BACKEND_RANK?: string;
  readonly VITE_RANKING_NEIGHBORS_ENABLED?: string;
  readonly VITE_UX_V2_SINGLE?: string;
  readonly VITE_UX_V2_FLASH?: string;
  readonly VITE_UX_V2_DUEL?: string;
  readonly VITE_UX_V2_CHALLENGE?: string;
  readonly VITE_MECHANICS_V2_SINGLE?: string;
  readonly VITE_MECHANICS_V2_FLASH?: string;
  readonly VITE_MECHANICS_V2_DUEL?: string;
  readonly VITE_MECHANICS_V2_CHALLENGE?: string;
  readonly VITE_UX_TELEMETRY_ENABLED?: string;
  readonly VITE_UX_TELEMETRY_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}


declare const __APP_VERSION__: string;
