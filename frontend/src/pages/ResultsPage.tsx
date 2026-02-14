import { useEffect, useState } from 'react';
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

  useEffect(() => {
    // Fetch user rank
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

  // If no game was played, redirect to menu
  if (questions.length === 0 && !loading) {
    navigate('/menu');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 py-8">
      <div className="max-w-lg w-full">
        {/* Results Card */}
        <div className="bg-gray-800 rounded-xl p-8 text-center shadow-lg">
          {/* Performance Emoji */}
          <div className="text-7xl mb-4">{getPerformanceEmoji()}</div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-white mb-2">
            {t('results.gameOver')}
          </h1>
          <p className="text-xl text-gray-400 mb-6">{getPerformanceMessage()}</p>

          {/* Score Display */}
          <div className="bg-gray-900 rounded-xl p-6 mb-6">
            <div className="text-5xl font-bold text-primary mb-2">
              {score.toLocaleString()}
            </div>
            <div className="text-gray-400">{t('results.points')}</div>

          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-400">
                {correctAnswers}
              </div>
              <div className="mt-1 flex justify-center">
                <AnswerStatusBadge status="correct" label={t('results.correct')} className="text-xs" />
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-400">
                {totalQuestions - correctAnswers}
              </div>
              <div className="mt-1 flex justify-center">
                <AnswerStatusBadge status="incorrect" label={t('results.incorrect')} className="text-xs" />
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="text-2xl font-bold text-white">{percentage}%</div>
              <div className="text-xs text-gray-400">{t('results.accuracy')}</div>
            </div>
          </div>

          {/* Rank */}
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

          {/* Action Buttons */}
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

        {/* Share Section */}
        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm mb-3">{t('results.shareScore')}</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => {
                const text = `${t('results.shareText', { score, correct: correctAnswers, total: totalQuestions })} 🌍`;
                navigator.clipboard.writeText(text);
                alert(t('results.copied'));
              }}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
            >
              📋 {t('results.copyScore')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
