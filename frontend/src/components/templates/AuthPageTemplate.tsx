import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../molecules/Card';
import { Icon } from '../atoms/Icon';

type AuthPageTemplateProps = {
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};

export function AuthPageTemplate({ title, children, footer }: AuthPageTemplateProps) {
  return (
    <div className="app-shell">
      <main className="mx-auto flex h-full min-h-0 w-full max-w-md flex-1 flex-col justify-center px-4 py-6 sm:py-8">
        <div className="mb-5 text-center">
          <Link to="/" className="inline-flex flex-col items-center gap-2">
            <Icon symbol="🌍" className="text-4xl" />
            <h1 className="text-2xl font-bold text-white">
              <span className="text-primary">Geo</span>Challenge
            </h1>
          </Link>
        </div>

        <Card className="p-5 sm:p-8">
          <h2 className="mb-6 text-center text-2xl font-bold text-white">{title}</h2>
          {children}
        </Card>

        {footer}
      </main>
    </div>
  );
}
