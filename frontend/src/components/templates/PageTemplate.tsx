import React from 'react';
import { ScreenLayout } from '../organisms/ScreenLayout';

type PageTemplateProps = {
  header?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
};

export function PageTemplate({ header, children, contentClassName }: PageTemplateProps) {
  return (
    <ScreenLayout header={header} contentClassName={contentClassName}>
      {children}
    </ScreenLayout>
  );
}
