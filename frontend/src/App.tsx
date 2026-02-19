import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GameProvider } from './context/GameContext';
import {
  HomePage,
  LoginPage,
  RegisterPage,
  MenuPage,
  GamePage,
  ResultsPage,
  RankingsPage,
  ProfilePage,
  DuelPage,
  ChallengesPage,
  ChallengeGamePage,
  ChallengeResultsPage,
} from './pages';
import { LoadingSpinner, ErrorBoundary, ServerWakeUp, BackendKeepAlive, AppRoot, Screen } from './components';
import { getRouterBasename, toAppPath } from './utils/routing';

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-full min-h-0 bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
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
    return (
      <div className="h-full min-h-0 bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/menu" replace />;
  }

  return <>{children}</>;
}

// Router error fallback
function RouteErrorFallback() {
  return (
    <div className="h-full min-h-0 bg-gray-900 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-6xl mb-4">:(</div>
        <h2 className="text-2xl font-bold text-white mb-2">Algo salio mal</h2>
        <p className="text-gray-400 mb-6">Ha ocurrido un error inesperado</p>
        <a
          href={toAppPath('/menu')}
          className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors inline-block"
        >
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
          <Outlet />
        </Screen>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export function SinglePlayerGameLayout() {
  return (
    <GameProvider>
      <Outlet />
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
        element: <ProtectedRoute><RankingsPage /></ProtectedRoute>,
      },
      {
        path: '/profile',
        element: <ProtectedRoute><ProfilePage /></ProtectedRoute>,
      },
      {
        path: '/duel',
        element: <ProtectedRoute><DuelPage /></ProtectedRoute>,
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
      <ServerWakeUp>
        <BackendKeepAlive />
        <RouterProvider router={router} />
      </ServerWakeUp>
    </AppRoot>
  );
}

export default App;
