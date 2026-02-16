type AppFooterProps = {
  className?: string;
};

const APP_VERSION = __APP_VERSION__ || '0.0.0';

export function AppFooter({ className }: AppFooterProps) {
  return (
    <footer className={`app-footer ${className ?? ''}`.trim()}>
      <p>GeoChallenge &copy; {new Date().getFullYear()}</p>
      <p className="app-footer__version">v{APP_VERSION}</p>
    </footer>
  );
}

