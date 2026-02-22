import { ReactNode } from 'react';

type UniversalGameLayoutProps = {
  header: ReactNode;
  progress?: ReactNode;
  content: ReactNode;
  footer: ReactNode;
  className?: string;
};

export function UniversalGameLayout({ header, progress, content, footer, className = '' }: UniversalGameLayoutProps) {
  return (
    <div className={`universal-layout ${className}`.trim()}>
      <div className="layout-header" data-testid="universal-layout-header">
        {header}
        {progress ? <div className="layout-progress">{progress}</div> : null}
      </div>
      <section className="content-area" data-testid="universal-layout-main">{content}</section>
      <div className="layout-footer" data-testid="universal-layout-footer">{footer}</div>
    </div>
  );
}
