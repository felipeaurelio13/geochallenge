import { ReactNode } from 'react';

type UniversalGameLayoutProps = {
  header: ReactNode;
  progress?: ReactNode;
  content: ReactNode;
  footer: ReactNode;
  /** En móvil el feedback de resultado se superpone al contenido para no comprimir la ronda. */
  footerOverlay?: boolean;
  className?: string;
};

export function UniversalGameLayout({
  header,
  progress,
  content,
  footer,
  footerOverlay = false,
  className = '',
}: UniversalGameLayoutProps) {
  return (
    <div className={`universal-layout ${footerOverlay ? 'universal-layout--footer-overlay' : ''} ${className}`.trim()}>
      <div className="layout-header" data-testid="universal-layout-header">
        {header}
        {progress ? <div className="layout-progress">{progress}</div> : null}
      </div>
      <section className="content-area" data-testid="universal-layout-main">{content}</section>
      <div className="layout-footer" data-testid="universal-layout-footer">{footer}</div>
    </div>
  );
}
