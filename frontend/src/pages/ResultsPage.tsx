import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGame } from '../context/GameContext';
import { api } from '../services/api';
import { LoadingSpinner } from '../components';
import { AnswerStatusBadge } from '../components/AnswerStatusBadge';

export function ResultsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, resetGame } = useGame();

  const { score, questions, results } = state;
  const correctAnswers = results.filter(r => r.isCorrect).length;

  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareStatus, setShareStatus] = useState<'idle' | 'success'>('idle');

  useEffect(() => {
    const fetchRank = async () => {
      try {
        const rankData = await api.getMyRank();
        setUserRank(rankData.userRank?.rank || null);
      } catch (err) {
        console.error('Failed to fetch rank:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRank();
  }, []);

  const totalQuestions = questions.length || 10;
  const percentage = Math.round((correctAnswers / totalQuestions) * 100);

  const shareText = useMemo(
    () => t('results.shareText', { score, correct: correctAnswers, total: totalQuestions, accuracy: `${percentage}%` }),
    [t, score, correctAnswers, totalQuestions, percentage]
  );

  const getPerformanceEmoji = () => {
    if (percentage >= 90) return '🏆';
    if (percentage >= 70) return '🎉';
    if (percentage >= 50) return '👍';
    if (percentage >= 30) return '🤔';
    return '💪';
  };

  const getPerformanceMessage = () => {
    if (percentage >= 90) return t('results.excellent');
    if (percentage >= 70) return t('results.great');
    if (percentage >= 50) return t('results.good');
    if (percentage >= 30) return t('results.keepPracticing');
    return t('results.tryAgain');
  };

  const handlePlayAgain = () => {
    resetGame();
    navigate('/menu');
  };

  const handleShareResults = async () => {
    const sharePayload = {
      title: t('app.name'),
      text: shareText,
    };

    try {
      if (navigator.share) {
        await navigator.share(sharePayload);
      } else {
        await navigator.clipboard.writeText(shareText);
      }

      setShareStatus('success');
      window.setTimeout(() => setShareStatus('idle'), 2500);
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        console.error('Failed to share score:', error);
      }
    }
  };

  if (questions.length === 0 && !loading) {
    navigate('/menu');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 py-8">
      <div className="max-w-lg w-full">
        <div className="bg-gray-800 rounded-xl p-6 sm:p-8 text-center shadow-lg">
          <div className="text-6xl sm:text-7xl mb-4">{getPerformanceEmoji()}</div>

          <h1 className="text-3xl font-bold text-white mb-2">
            {t('results.gameOver')}
          </h1>
          <p className="text-xl text-gray-400 mb-6">{getPerformanceMessage()}</p>

          <div className="bg-gray-900 rounded-xl p-6 mb-6">
            <div className="text-5xl font-bold text-primary mb-2">
              {score.toLocaleString()}
            </div>
            <div className="text-gray-400">{t('results.points')}</div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
            <div className="min-w-0 bg-gray-900 rounded-lg p-3 sm:p-4">
              <div className="text-2xl font-bold text-green-400">
                {correctAnswers}
              </div>
              <div className="mt-2 flex justify-center min-w-0">
                <AnswerStatusBadge
                  status="correct"
                  label={t('results.correct')}
                  className="w-full justify-center text-[11px] sm:text-xs"
                />
              </div>
            </div>
            <div className="min-w-0 bg-gray-900 rounded-lg p-3 sm:p-4">
              <div className="text-2xl font-bold text-red-400">
                {totalQuestions - correctAnswers}
              </div>
              <div className="mt-2 flex justify-center min-w-0">
                <AnswerStatusBadge
                  status="incorrect"
                  label={t('results.incorrect')}
                  className="w-full justify-center text-[11px] sm:text-xs"
                />
              </div>
            </div>
            <div className="min-w-0 bg-gray-900 rounded-lg p-3 sm:p-4">
              <div className="text-2xl font-bold text-white">{percentage}%</div>
              <div className="text-xs text-gray-400">{t('results.accuracy')}</div>
            </div>
          </div>

          {loading ? (
            <div className="mb-6">
              <LoadingSpinner size="sm" />
            </div>
          ) : userRank ? (
            <div className="mb-6 p-4 bg-gradient-to-r from-yellow-900/50 to-orange-900/50 rounded-lg border border-yellow-700">
              <div className="text-sm text-yellow-300 mb-1">{t('results.yourRank')}</div>
              <div className="text-3xl font-bold text-yellow-400">#{userRank}</div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            <button
              onClick={handlePlayAgain}
              className="w-full py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/80 transition-colors"
            >
              {t('results.playAgain')}
            </button>
            <Link
              to="/rankings"
              className="w-full py-3 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-600 transition-colors inline-block"
            >
              {t('results.viewRankings')}
            </Link>
            <Link
              to="/menu"
              className="text-gray-400 hover:text-white transition-colors mt-2"
            >
              {t('common.backToMenu')}
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center rounded-xl border border-gray-800 bg-gray-900/60 p-4 sm:p-5">
          <p className="text-gray-300 text-sm mb-3">{t('results.shareScore')}</p>
          <button
            onClick={handleShareResults}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 sm:w-auto"
          >
            🔗 {t('results.shareButton')}
          </button>
          <p className="mt-2 min-h-5 text-xs text-green-300" aria-live="polite">
            {shareStatus === 'success' ? t('results.copied') : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
