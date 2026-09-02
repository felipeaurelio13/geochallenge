import type { DailyTourDetails } from '../../types';
import { getLocalizedCountryName } from '../../utils/countryNames';

interface DailyTourStripProps {
  details: DailyTourDetails[];
  language: string;
  compact?: boolean;
}

export function DailyTourStrip({ details, language, compact }: DailyTourStripProps) {
  if (!details || details.length === 0) return null;

  return (
    <div className={`w-full ${compact ? '' : 'max-w-sm'}`}>
      <div className="flex flex-wrap gap-1.5 justify-center">
        {details.map((d) => {
          const countryName = getLocalizedCountryName(d.countryCode, language, d.countryCode);
          return (
            <span
              key={d.questionId}
              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                d.isCorrect
                  ? 'bg-success/15 text-success border border-success/30'
                  : 'bg-error/15 text-error border border-error/30'
              }`}
              title={`${countryName} — ${d.isCorrect ? 'correcto' : 'incorrecto'}`}
            >
              <span aria-hidden="true">
                {d.isCorrect ? '\u2713' : '\u2717'}
              </span>
              <span className="sr-only">{countryName} — {d.isCorrect ? 'correcto' : 'incorrecto'}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
