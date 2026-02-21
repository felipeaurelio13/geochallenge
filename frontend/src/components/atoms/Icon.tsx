import React from 'react';

type IconProps = {
  symbol: string;
  className?: string;
  label?: string;
};

export function Icon({ symbol, className = '', label }: IconProps) {
  if (label) {
    return (
      <span role="img" aria-label={label} className={className}>
        {symbol}
      </span>
    );
  }

  return (
    <span aria-hidden className={className}>
      {symbol}
    </span>
  );
}
