import { useEffect, useState } from 'react';

type Serializer<T> = {
  parse: (value: string) => T;
  stringify: (value: T) => string;
};

const defaultSerializer: Serializer<unknown> = {
  parse: JSON.parse,
  stringify: JSON.stringify,
};

export function useLocalStorage<T>(key: string, initialValue: T, serializer?: Serializer<T>) {
  const activeSerializer = serializer ?? (defaultSerializer as Serializer<T>);

  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    const item = window.localStorage.getItem(key);
    if (!item) {
      return initialValue;
    }

    try {
      return activeSerializer.parse(item);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(key, activeSerializer.stringify(storedValue));
  }, [key, activeSerializer, storedValue]);

  return [storedValue, setStoredValue] as const;
}
