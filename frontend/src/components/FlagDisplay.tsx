import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useImageWithFallback } from '../hooks/useImageWithFallback';
import type { FlagModifier } from '../types';

interface FlagDisplayProps {
  imageUrl?: string;
  modifier: FlagModifier;
  /** Estable por pregunta. Garantiza que el crop se vea igual entre renders. */
  questionId: string;
  /** Si el container debe ser compacto (modo móvil / pantalla chica). */
  compact?: boolean;
}

const CROP_SCALE = 2.5;
const CROP_ORIGINS = [
  '20% 25%',
  '80% 25%',
  '20% 75%',
  '80% 75%',
  '50% 18%',
] as const;

/**
 * Hash determinístico (djb2-ish) sobre el questionId para escoger una de las
 * posiciones de crop. Mismo questionId → mismo crop entre renders/sesiones.
 */
function pickCropOrigin(questionId: string): string {
  let h = 5381;
  for (let i = 0; i < questionId.length; i += 1) {
    h = ((h << 5) + h + questionId.charCodeAt(i)) | 0;
  }
  return CROP_ORIGINS[Math.abs(h) % CROP_ORIGINS.length];
}

function normalizeFlagUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url.replace(/(flagcdn\.com\/w\d+\/)([A-Z]{2})(\.png)$/i, (_match, prefix, code, suffix) => {
    return `${prefix}${String(code).toLowerCase()}${suffix}`;
  });
}

/**
 * Renderiza una bandera con el modificador visual de Flag Master aplicado vía
 * CSS puro sobre la misma URL del CDN. Sin canvas, sin pre-procesamiento.
 *
 *   none      → render normal
 *   grayscale → filter: grayscale(1)
 *   crop      → wrapper con overflow:hidden + img con scale(2.5) y origin determinístico
 *   similar   → render normal (el modifier sólo cambia las opciones, no la imagen)
 *   combined  → grayscale + crop
 */
export function FlagDisplay({ imageUrl, modifier, questionId, compact = false }: FlagDisplayProps) {
  const { t } = useTranslation();
  const normalized = useMemo(() => normalizeFlagUrl(imageUrl), [imageUrl]);
  const { src, hasError, handleError } = useImageWithFallback(normalized);

  const isGrayscale = modifier === 'grayscale' || modifier === 'combined';
  const isCropped = modifier === 'crop' || modifier === 'combined';
  const cropOrigin = isCropped ? pickCropOrigin(questionId) : undefined;

  const containerClass = compact
    ? 'relative mx-auto aspect-[1.89/1] w-full max-w-sm overflow-hidden rounded-xl border border-[var(--color-border)]/60 bg-black/15'
    : 'relative mx-auto aspect-[1.89/1] w-full max-w-md overflow-hidden rounded-xl border border-[var(--color-border)]/60 bg-black/15';

  if (!src || hasError) {
    return (
      <div
        className={`${containerClass} flex flex-col items-center justify-center gap-2`}
        role="img"
        aria-label={t('flagMaster.imageUnavailable', 'Bandera no disponible')}
      >
        <span className="text-4xl opacity-30">🏳️</span>
        <p className="text-xs text-app-subtle">
          {t('flagMaster.imageUnavailable', 'Bandera no disponible')}
        </p>
      </div>
    );
  }

  const imgStyle: React.CSSProperties = {
    height: '100%',
    width: '100%',
    objectFit: 'contain',
    objectPosition: 'center',
    transition: 'filter 200ms ease, transform 200ms ease',
    ...(isGrayscale && { filter: 'grayscale(1) contrast(1.05)' }),
    ...(isCropped && cropOrigin && {
      transform: `scale(${CROP_SCALE})`,
      transformOrigin: cropOrigin,
    }),
  };

  const altKey =
    modifier === 'grayscale'
      ? t('flagMaster.altGrayscale', 'Bandera en escala de grises')
      : modifier === 'crop'
      ? t('flagMaster.altCrop', 'Bandera recortada')
      : modifier === 'combined'
      ? t('flagMaster.altCombined', 'Bandera recortada y en escala de grises')
      : t('flagMaster.altNormal', 'Bandera del país');

  return (
    <div
      className={containerClass}
      data-testid="flag-display"
      data-modifier={modifier}
      data-crop-origin={cropOrigin ?? undefined}
    >
      <img
        src={src}
        alt={altKey}
        loading="eager"
        onError={handleError}
        style={imgStyle}
      />
    </div>
  );
}
