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
      <div className="layout-header">{header}</div>
      {progress ? <div className="layout-progress">{progress}</div> : null}
      <section className="content-area">{content}</section>
      <div className="layout-footer">{footer}</div>
    </div>
  );
}
