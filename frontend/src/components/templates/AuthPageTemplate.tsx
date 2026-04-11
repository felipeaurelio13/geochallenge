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
    <div className="mx-auto my-auto w-full max-w-md px-4 py-4 sm:py-6">
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
    </div>
  );
}
