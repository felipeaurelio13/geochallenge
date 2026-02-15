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
import { LoadingSpinner, ErrorBoundary, ServerWakeUp } from './components';

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
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
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-6xl mb-4">:(</div>
        <h2 className="text-2xl font-bold text-white mb-2">Algo salio mal</h2>
        <p className="text-gray-400 mb-6">Ha ocurrido un error inesperado</p>
        <a
          href="/menu"
          className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors inline-block"
        >
          Volver al menu
        </a>
      </div>
    </div>
  );
}

// App wrapper that provides Auth context with error boundary
function AppWrapper({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary><AuthProvider>{children}</AuthProvider></ErrorBoundary>;
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
      path: '/',
      element: <AppWrapper><HomePage /></AppWrapper>,
      errorElement: <RouteErrorFallback />,
    },
    {
      path: '/login',
      element: <AppWrapper><PublicRoute><LoginPage /></PublicRoute></AppWrapper>,
    },
    {
      path: '/register',
      element: <AppWrapper><PublicRoute><RegisterPage /></PublicRoute></AppWrapper>,
    },
    {
      path: '/menu',
      element: <AppWrapper><ProtectedRoute><MenuPage /></ProtectedRoute></AppWrapper>,
    },
    {
      element: <AppWrapper><ProtectedRoute><SinglePlayerGameLayout /></ProtectedRoute></AppWrapper>,
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
      element: <AppWrapper><ProtectedRoute><RankingsPage /></ProtectedRoute></AppWrapper>,
    },
    {
      path: '/profile',
      element: <AppWrapper><ProtectedRoute><ProfilePage /></ProtectedRoute></AppWrapper>,
    },
    {
      path: '/duel',
      element: <AppWrapper><ProtectedRoute><DuelPage /></ProtectedRoute></AppWrapper>,
    },
    {
      path: '/challenges',
      element: <AppWrapper><ProtectedRoute><ChallengesPage /></ProtectedRoute></AppWrapper>,
    },
    {
      path: '/challenges/:id/play',
      element: <AppWrapper><ProtectedRoute><ChallengeGamePage /></ProtectedRoute></AppWrapper>,
    },

    {
      path: '/challenges/:id/results',
      element: <AppWrapper><ProtectedRoute><ChallengeResultsPage /></ProtectedRoute></AppWrapper>,
    },
    {
      path: '*',
      element: <AppWrapper><Navigate to="/" replace /></AppWrapper>,
    },
];

const router = createBrowserRouter(
  appRoutes,
  {
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
    <ServerWakeUp>
      <RouterProvider router={router} />
    </ServerWakeUp>
  );
}

export default App;
