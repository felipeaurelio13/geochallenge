import { ReactNode, useEffect, useRef } from 'react';

type UniversalGameLayoutProps = {
  header: ReactNode;
  progress?: ReactNode;
  content: ReactNode;
  footer: ReactNode;
  className?: string;
};

export function UniversalGameLayout({ header, progress, content, footer, className = '' }: UniversalGameLayoutProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!rootRef.current || !footerRef.current) {
      return;
    }

    const root = rootRef.current;
    const updateTrayHeight = () => {
      const footerHeight = footerRef.current?.offsetHeight ?? 0;
      root.style.setProperty('--action-tray-h', `${footerHeight}px`);
    };

    updateTrayHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateTrayHeight();
    });

    resizeObserver.observe(footerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef} className={`universal-layout ${className}`.trim()}>
      <div className="layout-header" data-testid="universal-layout-header">
        {header}
        {progress ? <div className="layout-progress">{progress}</div> : null}
      </div>
      <section className="content-area" data-testid="universal-layout-main">{content}</section>
      <div ref={footerRef} className="layout-footer" data-testid="universal-layout-footer">{footer}</div>
    </div>
  );
}
