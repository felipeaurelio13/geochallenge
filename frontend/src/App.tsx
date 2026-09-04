import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { buttonVariants } from './components/atoms/Button';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GameProvider } from './context/GameContext';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { MenuPage } from './pages/MenuPage';
import {
  ErrorBoundary,
  AppRoot,
  Screen,
  AuthRouteLoading,
} from './components';
import { getRouterBasename, toAppPath } from './utils/routing';

export const GamePage = lazy(() => import('./pages/GamePage').then((m) => ({ default: m.GamePage })));
export const ResultsPage = lazy(() => import('./pages/ResultsPage').then((m) => ({ default: m.ResultsPage })));
export const FlashGamePage = lazy(() => import('./pages/FlashGamePage').then((m) => ({ default: m.FlashGamePage })));
export const RankingsPage = lazy(() => import('./pages/RankingsPage').then((m) => ({ default: m.RankingsPage })));
export const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
export const PassportPage = lazy(() => import('./pages/PassportPage').then((m) => ({ default: m.PassportPage })));
export const DuelPage = lazy(() => import('./pages/DuelPage').then((m) => ({ default: m.DuelPage })));
export const CompetitionPage = lazy(() => import('./pages/CompetitionPage').then((m) => ({ default: m.CompetitionPage })));
export const ChallengesPage = lazy(() => import('./pages/ChallengesPage').then((m) => ({ default: m.ChallengesPage })));
export const ChallengeGamePage = lazy(() => import('./pages/ChallengeGamePage').then((m) => ({ default: m.ChallengeGamePage })));
export const ChallengeResultsPage = lazy(() => import('./pages/ChallengeResultsPage').then((m) => ({ default: m.ChallengeResultsPage })));
export const DailyChallengePage = lazy(() => import('./pages/DailyChallengePage').then((m) => ({ default: m.DailyChallengePage })));
export const WorldEventPage = lazy(() => import('./pages/WorldEventPage').then((m) => ({ default: m.WorldEventPage })));
export const SurvivalPage = lazy(() => import('./pages/SurvivalPage').then((m) => ({ default: m.SurvivalPage })));
export const FlagMasterPage = lazy(() => import('./pages/FlagMasterPage').then((m) => ({ default: m.FlagMasterPage })));
export const GeoChallengesPage = lazy(() => import('./pages/GeoChallengesPage').then((m) => ({ default: m.GeoChallengesPage })));
export const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
export const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <AuthRouteLoading />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Public route wrapper (redirect if logged in)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <AuthRouteLoading />;
  }

  if (user) {
    return <Navigate to="/menu" replace />;
  }

  return <>{children}</>;
}

// Router error fallback
function RouteErrorFallback() {
  return (
    <div className="h-full min-h-0 bg-[var(--color-bg-app)] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-6xl mb-4">:(</div>
        <h2 className="text-2xl font-bold text-app-text mb-2">Algo salio mal</h2>
        <p className="text-[var(--color-text-muted)] mb-6">Ha ocurrido un error inesperado</p>
        <a href={toAppPath('/menu')} className={buttonVariants({ variant: 'primary', size: 'lg' })}>
          Volver al menu
        </a>
      </div>
    </div>
  );
}

function RootProviders() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Screen>
          <Suspense fallback={<AuthRouteLoading />}>
            <Outlet />
          </Suspense>
        </Screen>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export function SinglePlayerGameLayout() {
  return (
    <GameProvider>
      <Suspense fallback={<AuthRouteLoading />}>
        <Outlet />
      </Suspense>
    </GameProvider>
  );
}

// Create router with future flags to avoid warnings
export const appRoutes = [
  {
    element: <RootProviders />,
    errorElement: <RouteErrorFallback />,
    children: [
      {
        path: '/',
        element: <HomePage />,
      },
      {
        path: '/login',
        element: <PublicRoute><LoginPage /></PublicRoute>,
      },
      {
        path: '/register',
        element: <PublicRoute><RegisterPage /></PublicRoute>,
      },
      {
        path: '/forgot-password',
        element: <PublicRoute><ForgotPasswordPage /></PublicRoute>,
      },
      {
        path: '/reset-password',
        element: <PublicRoute><ResetPasswordPage /></PublicRoute>,
      },
      {
        path: '/menu',
        element: <ProtectedRoute><MenuPage /></ProtectedRoute>,
      },
      {
        element: <ProtectedRoute><SinglePlayerGameLayout /></ProtectedRoute>,
        children: [
          {
            path: '/game/single',
            element: <GamePage />,
          },
          {
            path: '/results',
            element: <ResultsPage />,
          },
        ],
      },
      {
        path: '/rankings',
        element: <RankingsPage />,
      },
      {
        path: '/profile',
        element: <ProtectedRoute><ProfilePage /></ProtectedRoute>,
      },
      {
        path: '/passport',
        element: <ProtectedRoute><PassportPage /></ProtectedRoute>,
      },
      {
        path: '/game/flash',
        element: <ProtectedRoute><FlashGamePage /></ProtectedRoute>,
      },
      {
        path: '/duel',
        element: <ProtectedRoute><DuelPage /></ProtectedRoute>,
      },
      {
        path: '/competition',
        element: <ProtectedRoute><CompetitionPage /></ProtectedRoute>,
      },
      {
        path: '/challenges',
        element: <ProtectedRoute><ChallengesPage /></ProtectedRoute>,
      },
      {
        path: '/challenges/:id/play',
        element: <ProtectedRoute><ChallengeGamePage /></ProtectedRoute>,
      },
      {
        path: '/challenges/:id/results',
        element: <ProtectedRoute><ChallengeResultsPage /></ProtectedRoute>,
      },
      {
        path: '/daily',
        element: <ProtectedRoute><DailyChallengePage /></ProtectedRoute>,
      },
      {
        path: '/event',
        element: <ProtectedRoute><WorldEventPage /></ProtectedRoute>,
      },
      {
        path: '/survival',
        element: <ProtectedRoute><SurvivalPage /></ProtectedRoute>,
      },
      {
        path: '/flag-master',
        element: <ProtectedRoute><FlagMasterPage /></ProtectedRoute>,
      },
      {
        path: '/geo-challenges',
        element: <ProtectedRoute><GeoChallengesPage /></ProtectedRoute>,
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
];

const router = createBrowserRouter(
  appRoutes,
  {
    basename: getRouterBasename(),
    future: {
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  }
);

export function App() {
  return (
    <AppRoot>
      <RouterProvider router={router} />
    </AppRoot>
  );
}

export default App;
