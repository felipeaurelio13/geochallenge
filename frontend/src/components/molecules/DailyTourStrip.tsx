import type { DailyTourDetails } from '../../types';

interface DailyTourStripProps {
  details: DailyTourDetails[];
  language: string;
  compact?: boolean;
}

function getCountryName(countryCode: string, language: string): string {
  try {
    const names = new Intl.DisplayNames([language], { type: 'region' });
    return names.of(countryCode) ?? countryCode;
  } catch {
    return countryCode;
  }
}

export function DailyTourStrip({ details, language, compact }: DailyTourStripProps) {
  if (!details || details.length === 0) return null;

  return (
    <div className={`w-full ${compact ? '' : 'max-w-sm'}`}>
      <div className="flex flex-wrap gap-1.5 justify-center">
        {details.map((d) => {
          const countryName = getCountryName(d.countryCode, language);
          return (
            <span
              key={d.questionId}
              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                d.isCorrect
                  ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                  : 'bg-red-500/15 text-red-400 border border-red-500/30'
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
