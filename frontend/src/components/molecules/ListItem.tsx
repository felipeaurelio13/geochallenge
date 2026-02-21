import React from 'react';

type ListItemProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
};

export function ListItem({ title, description, leading, trailing, className = '' }: ListItemProps) {
  return (
    <li className={`flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-950 p-3 ${className}`.trim()}>
      {leading ? <div className="pt-0.5">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{title}</p>
        {description ? <p className="mt-0.5 text-sm text-gray-300">{description}</p> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </li>
  );
}
