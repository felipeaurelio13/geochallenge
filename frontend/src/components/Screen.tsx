import React from 'react';
import { useLocation } from 'react-router-dom';
import { AppFooter } from './AppFooter';

export type ScreenProps = {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

// Screen encapsulates a single viewport-sized route with fixed header/footer slots.
export function Screen({ header, footer, children }: ScreenProps) {
  const { pathname } = useLocation();
  // QA fix HI-6/ME-4: agregamos /daily y /flag-master a las rutas de gameplay
  // para que el AppFooter ("v1.2.87" + año) no aparezca mid-juego.
  //
  // Además, /profile, /rankings, /challenges y /survival son páginas con
  // contenido scrollable interno: el footer global se renderizaba debajo
  // del scroll-container y daba la falsa sensación de "fin de página" sin
  // pista de "hay más abajo". Ocultarlo en esas rutas resuelve la
  // confusión visual sin cambiar el layout interno.
  const isFullViewportRoute = pathname.startsWith('/game/')
    || pathname === '/duel'
    || pathname === '/daily'
    || pathname === '/flag-master'
    || pathname === '/survival'
    || pathname === '/profile'
    || pathname === '/rankings'
    || pathname.startsWith('/challenges')
    || /^\/challenges\/[^/]+\/play$/.test(pathname);
  const isGameplayRoute = isFullViewportRoute;
  const footerContent = footer ?? <AppFooter />;

  return (
    <section className="screen min-h-0">
      {header ? <header className="screen-header">{header}</header> : null}
      <main className="screen-content overflow-y-auto overscroll-contain">{children}</main>
      {!isGameplayRoute && <footer className="screen-footer">{footerContent}</footer>}
    </section>
  );
}
