import axios from 'axios';

/**
 * Extrae un mensaje legible de cualquier error de API.
 *
 * El interceptor de api.ts ya convierte la mayoría de los errores del backend
 * en `Error` con el mensaje del servidor, pero algunos paths (short-game
 * availability) re-lanzan el AxiosError original. Este helper cubre ambos
 * casos para que las páginas no repitan `err.response?.data?.error || ...`.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    const backendMessage = data?.error || data?.message;
    if (typeof backendMessage === 'string' && backendMessage.trim().length > 0) {
      return backendMessage;
    }
  }
  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message;
  }
  return fallback;
}
