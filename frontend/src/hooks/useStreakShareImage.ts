import { useCallback, useState } from 'react';

export interface StreakShareData {
  correctCount: number;
  category: string;
  date: string;
  score?: number;
}

function buildCanvas(data: StreakShareData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d')!;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 1080);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(1, '#042f2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1080);

  // Accent circle glow
  const glow = ctx.createRadialGradient(540, 440, 0, 540, 440, 380);
  glow.addColorStop(0, 'rgba(34,211,238,0.18)');
  glow.addColorStop(1, 'rgba(34,211,238,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1080, 1080);

  // App name
  ctx.font = 'bold 52px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#22d3ee';
  ctx.textAlign = 'center';
  ctx.fillText('GeoChallenge', 540, 120);

  // Fire emoji + streak count
  ctx.font = '200px serif';
  ctx.fillText('🔥', 540, 380);

  ctx.font = 'bold 160px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(data.correctCount), 540, 560);

  ctx.font = 'bold 52px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('respuestas seguidas', 540, 640);

  // Category badge
  const badgeY = 720;
  ctx.fillStyle = 'rgba(34,211,238,0.15)';
  ctx.beginPath();
  ctx.roundRect(280, badgeY - 50, 520, 80, 40);
  ctx.fill();
  ctx.font = 'bold 40px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#22d3ee';
  ctx.fillText(data.category.toUpperCase(), 540, badgeY + 10);

  // Score if available
  if (data.score !== undefined && data.score > 0) {
    ctx.font = '36px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`${data.score} puntos`, 540, 840);
  }

  // Date
  ctx.font = '32px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(data.date, 540, 960);

  // Bottom tagline
  ctx.font = 'italic 28px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('¿Puedes superarme? geochallengeapp.com', 540, 1030);

  return canvas;
}

async function canvasToFile(canvas: HTMLCanvasElement, filename: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Canvas export failed')); return; }
      resolve(new File([blob], filename, { type: 'image/png' }));
    }, 'image/png');
  });
}

type ShareStatus = 'idle' | 'sharing' | 'shared' | 'downloaded' | 'error';

export function useStreakShareImage() {
  const [status, setStatus] = useState<ShareStatus>('idle');

  const share = useCallback(async (data: StreakShareData): Promise<ShareStatus> => {
    setStatus('sharing');
    try {
      const canvas = buildCanvas(data);
      const file = await canvasToFile(canvas, `geochallenge-streak-${data.correctCount}.png`);

      const shareText = `🔥 Racha de ${data.correctCount} en GeoChallenge [${data.category.toUpperCase()}]${data.score ? ` · ${data.score} puntos` : ''}`;

      // Try Web Share API with file (supports Instagram Stories on mobile)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'GeoChallenge',
          text: shareText,
        });
        setStatus('shared');
        return 'shared';
      }

      // Fallback: try text-only share
      if (navigator.share) {
        await navigator.share({ title: 'GeoChallenge', text: shareText });
        setStatus('shared');
        return 'shared';
      }

      // Fallback: download the image
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('downloaded');
      return 'downloaded';
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setStatus('idle');
        return 'idle';
      }
      console.error('Streak share failed:', err);
      setStatus('error');
      return 'error';
    }
  }, []);

  return { share, status };
}
