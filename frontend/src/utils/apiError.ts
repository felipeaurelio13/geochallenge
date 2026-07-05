import axios from 'axios';
// OJO: importar el paquete `i18next` directo (singleton), NO `../i18n` (el
// módulo de bootstrap de la app). `../i18n` llama `.use(initReactI18next)` a
// nivel de módulo, lo que revienta cualquier test que mockee `react-i18next`
// sin exportar `initReactI18next` (rompía duel-page.test.tsx). `i18next` es
// el mismo singleton que `../i18n` inicializa en main.tsx — leerlo acá
// funciona igual en producción sin acoplarse al bootstrap de React.
import i18n from 'i18next';
import { ApiError } from '../services/api';

/**
 * Forma estructurada que el backend adjunta (de forma aditiva, no rompe el
 * contrato existente) a errores 4xx/5xx: `error` sigue siendo el mensaje en
 * español de siempre (fallback garantizado), `code` es un identificador
 * estable (ej. `CHALLENGE_NOT_ENOUGH_QUESTIONS`) y `params` trae variables de
 * interpolación (ej. `{ min, max }`).
 */
interface StructuredApiErrorBody {
  error?: string;
  message?: string;
  code?: string;
  params?: Record<string, unknown>;
}

function normalizeParams(code: string | undefined, params: Record<string, unknown> | undefined) {
  // RATE_LIMITED viaja con `retryAfterSeconds` (segundos) pero el copy usa
  // {{minutes}} — convertimos acá, redondeando hacia arriba con mínimo 1.
  if (code === 'RATE_LIMITED' && params && typeof params.retryAfterSeconds === 'number') {
    const minutes = Math.max(1, Math.ceil((params.retryAfterSeconds as number) / 60));
    return { ...params, minutes };
  }
  return params;
}

/**
 * Núcleo compartido: dado un `code` + `params` opcionales y un mensaje de
 * fallback del servidor, resuelve el copy localizado en `apiErrors.<code>` o
 * cae al fallback. Usado tanto por `getApiErrorMessage` (HTTP) como por
 * `getSocketErrorMessage` (eventos `duel:error` / `survival:error`).
 */
function translateByCode(
  code: string | undefined,
  params: Record<string, unknown> | undefined,
  fallback: string
): string {
  if (code) {
    const translated = i18n.t(`apiErrors.${code}`, {
      ...(normalizeParams(code, params) ?? {}),
      defaultValue: fallback,
    });
    if (typeof translated === 'string' && translated.trim().length > 0) {
      return translated;
    }
  }
  return fallback;
}

/**
 * Igual que `getApiErrorMessage` pero para el payload de los eventos de
 * socket `duel:error` / `survival:error`: `{ message, code?, params? }`.
 * `message` es el fallback en español de siempre (garantizado); `code`/
 * `params` son aditivos y opcionales.
 */
export function getSocketErrorMessage(data: { message?: string; code?: string; params?: Record<string, unknown> } | undefined, fallback: string): string {
  const backendMessage = data?.message && data.message.trim().length > 0 ? data.message : fallback;
  return translateByCode(data?.code, data?.params, backendMessage);
}

/**
 * Extrae un mensaje legible de cualquier error de API.
 *
 * El interceptor de api.ts ya convierte la mayoría de los errores del backend
 * en un `ApiError` (Error enriquecido con `code`/`params`) o en un `Error`
 * plano con el mensaje del servidor; algunos paths (short-game availability)
 * re-lanzan el AxiosError original. Este helper cubre los tres casos para que
 * las páginas no repitan `err.response?.data?.error || ...`.
 *
 * Si hay un `code` disponible (de un ApiError o de un AxiosError sin
 * envolver), se busca la traducción correspondiente en `apiErrors.<code>`
 * (con `params` interpolados). Códigos desconocidos o no mapeados caen
 * automáticamente al string `error` del servidor vía `defaultValue` — no
 * rompe nada si el código no está en el catálogo i18n.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  let backendMessage: string | undefined;
  let code: string | undefined;
  let params: Record<string, unknown> | undefined;

  if (err instanceof ApiError) {
    backendMessage = err.message;
    code = err.code;
    params = err.params;
  } else if (axios.isAxiosError(err)) {
    const data = err.response?.data as StructuredApiErrorBody | undefined;
    backendMessage = data?.error || data?.message;
    code = data?.code;
    params = data?.params;
  }

  if (typeof backendMessage === 'string' && backendMessage.trim().length > 0) {
    return translateByCode(code, params, backendMessage);
  }

  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message;
  }
  return fallback;
}
